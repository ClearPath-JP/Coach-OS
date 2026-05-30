import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchBunnyCaptions, signBunnyUrl } from '@/lib/bunny'
import { startCaptionedRender, remotionConfigured } from '@/lib/remotion'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({
  sourceVideoId: z.string().uuid(),
  trimStartSec: z.number().min(0).default(0),
  trimEndSec: z.number().positive().nullable().default(null),
  captionStyle: z.enum(['tiktok', 'minimal', 'none']).default('tiktok'),
})

/**
 * POST /api/coach/promote/render
 * Starts a Remotion Lambda render of the source clip (trim + burned-in captions).
 * Records a `video_edits` row to track the job; the client polls /render/status.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`promote-render:${user.id}`, {
      windowMs: 60_000,
      max: 5,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many renders — wait a moment and try again' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    if (!remotionConfigured()) {
      return NextResponse.json(
        { error: 'Rendering is not set up yet — needs the Remotion Lambda + AWS env vars.' },
        { status: 503 }
      )
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const { sourceVideoId, trimStartSec, trimEndSec, captionStyle } = parsed.data

    // Authoritative source: the videos row (workspace-scoped) — don't trust client URLs.
    const service = createServiceClient()
    const { data: video, error: vErr } = await service
      .from('videos')
      .select('id, mp4_url, captions_vtt_url, duration_seconds')
      .eq('id', sourceVideoId)
      .eq('workspace_id', workspaceId)
      .single()
    if (vErr || !video?.mp4_url) {
      return NextResponse.json({ error: 'Source clip not found or not ready yet' }, { status: 404 })
    }

    // Clamp the trim window to the clip duration.
    const dur = typeof video.duration_seconds === 'number' && video.duration_seconds > 0 ? video.duration_seconds : null
    const start = Math.max(0, trimStartSec)
    let end = trimEndSec
    if (dur != null && (end == null || end > dur)) end = dur
    if (end != null && end <= start) {
      return NextResponse.json({ error: 'Trim end must be after the start' }, { status: 400 })
    }

    const cues = video.captions_vtt_url ? (await fetchBunnyCaptions(video.captions_vtt_url)).cues : []
    const captions = captionStyle === 'none' ? [] : cues

    const { renderId, bucketName } = await startCaptionedRender({
      // Sign the source so Remotion can fetch it past Bunny token auth (no-op if disabled).
      mp4Url: signBunnyUrl(video.mp4_url),
      trimStartSec: start,
      trimEndSec: end,
      captions,
      captionStyle,
    })

    const { data: edit, error: eErr } = await service
      .from('video_edits')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        source_video_id: sourceVideoId,
        source_mp4_url: video.mp4_url,
        trim_start_sec: start,
        trim_end_sec: end,
        caption_style: captionStyle,
        status: 'rendering',
        remotion_render_id: renderId,
        remotion_bucket: bucketName,
      })
      .select('id')
      .single()
    if (eErr) console.error('POST /api/coach/promote/render video_edits insert', eErr)

    return NextResponse.json({ data: { editId: edit?.id ?? null, renderId, bucketName } })
  } catch (err) {
    console.error('POST /api/coach/promote/render', err)
    return NextResponse.json({ error: 'Could not start the render — try again' }, { status: 500 })
  }
}
