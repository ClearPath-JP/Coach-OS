import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkDailyWorkspaceQuota } from '@/lib/spend-guard'
import { remotionConfigured, startTimelineRender, type TimelineRenderInput } from '@/lib/remotion'
import { signBunnyUrl, fetchBunnyCaptions } from '@/lib/bunny'
import { logServerError } from '@/lib/log-server-error'
import { TimelineSchema, totalDurationSec, MAX_TOTAL_SEC } from '@/lib/studio/timeline'
import { offsetCues } from '@/lib/studio/captions'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({ projectId: z.string().uuid() })

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { projectId } = parsed.data

  const rate = await checkRateLimitAsync(`studio-render:${user.id}`, { windowMs: 60_000, max: 5, failMode: 'closed' })
  if (!rate.success) {
    const res = NextResponse.json({ error: 'Too many renders — wait a moment and try again' }, { status: 429 })
    if (rate.retryAfter) res.headers.set('Retry-After', String(rate.retryAfter))
    return res
  }
  const quota = await checkDailyWorkspaceQuota(workspaceId, 'render', 40)
  if (!quota.allowed) return NextResponse.json({ error: 'Daily limit reached for this workspace — try again tomorrow.' }, { status: 429 })
  if (!remotionConfigured()) return NextResponse.json({ error: 'Rendering is not set up yet.' }, { status: 503 })

  const service = createServiceClient()

  const { data: inFlight } = await service.from('video_edits')
    .select('id').eq('project_id', projectId).eq('workspace_id', workspaceId).eq('status', 'rendering')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (inFlight?.id) return NextResponse.json({ data: { editId: inFlight.id } })

  const { data: project, error: pErr } = await service.from('video_projects')
    .select('id, timeline, caption_style').eq('id', projectId).eq('workspace_id', workspaceId).single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const tl = TimelineSchema.safeParse(project.timeline)
  if (!tl.success || tl.data.length === 0) return NextResponse.json({ error: 'Add at least one clip before rendering' }, { status: 400 })
  if (totalDurationSec(tl.data) > MAX_TOTAL_SEC) return NextResponse.json({ error: `Keep it under ${MAX_TOTAL_SEC}s` }, { status: 400 })

  const ids = [...new Set(tl.data.map((c) => c.sourceVideoId))]
  const { data: vids } = await service.from('videos')
    .select('id, mp4_url, captions_vtt_url').in('id', ids).eq('workspace_id', workspaceId)
  const byId = new Map((vids ?? []).map((v) => [v.id, v]))
  for (const c of tl.data) {
    const v = byId.get(c.sourceVideoId)
    if (!v?.mp4_url) return NextResponse.json({ error: 'A clip is missing or not ready yet' }, { status: 400 })
  }

  const { data: edit, error: eErr } = await service.from('video_edits').insert({
    workspace_id: workspaceId, coach_id: user.id, project_id: projectId,
    caption_style: project.caption_style, status: 'rendering',
  }).select('id').single()
  if (eErr || !edit) { await logServerError('POST /api/studio/render insert', eErr); return NextResponse.json({ error: 'Could not start the render' }, { status: 500 }) }
  const editId = edit.id

  await service.from('video_projects').update({ status: 'rendering', last_render_edit_id: editId, updated_at: new Date().toISOString() }).eq('id', projectId).eq('workspace_id', workspaceId)

  after(async () => {
    try {
      let cursorSec = 0
      const renderClips: TimelineRenderInput['clips'] = []
      let captions: TimelineRenderInput['captions'] = []
      for (const c of tl.data) {
        const v = byId.get(c.sourceVideoId)!
        renderClips.push({ mp4Url: signBunnyUrl(v.mp4_url!), inSec: c.inSec, outSec: c.outSec, crop: c.crop, captionsOn: c.captionsOn })
        if (c.captionsOn && project.caption_style !== 'none' && v.captions_vtt_url) {
          const { cues } = await fetchBunnyCaptions(signBunnyUrl(v.captions_vtt_url))
          captions = captions.concat(offsetCues(cues, { inSec: c.inSec, outSec: c.outSec, startSec: cursorSec }))
        }
        cursorSec += Math.max(0, c.outSec - c.inSec)
      }
      const { renderId, bucketName } = await startTimelineRender({ clips: renderClips, captions, captionStyle: project.caption_style as TimelineRenderInput['captionStyle'] })
      await service.from('video_edits').update({ remotion_render_id: renderId, remotion_bucket: bucketName }).eq('id', editId)
    } catch (err) {
      await logServerError('studio render kickoff', err)
      await service.from('video_edits').update({ status: 'failed', error: 'Could not start the render — try again' }).eq('id', editId)
      await service.from('video_projects').update({ status: 'failed' }).eq('id', projectId)
    }
  })

  return NextResponse.json({ data: { editId } })
}
