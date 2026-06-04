import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCaptionedRenderStatus, remotionConfigured } from '@/lib/remotion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron: reconcile stuck video_edits renders.
 * The client polls /api/coach/promote/render/status to flip a row 'rendering' →
 * 'done'/'failed' — but if the coach closes the tab, the Lambda render still
 * finishes while the DB row stays 'rendering' forever. This backstop polls Lambda
 * for any still-'rendering' rows and persists the terminal state.
 * Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
 * Schedule in vercel.json.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // No-op safely until the Remotion Lambda env is wired.
  if (!remotionConfigured()) {
    return NextResponse.json({ data: { skipped: 'remotion not configured' } })
  }

  const service = createServiceClient()

  // Only rows old enough that a normal render would have finished — avoids racing
  // the client's own polling on a fresh render.
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString()
  const { data: stuck, error } = await service
    .from('video_edits')
    .select('id, workspace_id, remotion_render_id, remotion_bucket')
    .eq('status', 'rendering')
    .not('remotion_render_id', 'is', null)
    .lt('created_at', cutoff)
    .limit(50)

  if (error) {
    console.error('[cron/reconcile-renders] query', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let done = 0
  let failed = 0
  let pending = 0
  for (const row of stuck ?? []) {
    if (!row.remotion_render_id || !row.remotion_bucket) continue
    try {
      const s = await getCaptionedRenderStatus(row.remotion_render_id, row.remotion_bucket)
      if (s.done && s.outputUrl) {
        await service
          .from('video_edits')
          .update({ status: 'done', output_url: s.outputUrl, completed_at: new Date().toISOString() })
          .eq('id', row.id)
        done++
      } else if (s.error) {
        await service
          .from('video_edits')
          .update({ status: 'failed', error: s.error.slice(0, 500) })
          .eq('id', row.id)
        failed++
      } else {
        pending++
      }
    } catch (err) {
      console.error('[cron/reconcile-renders] poll', row.id, err)
      pending++
    }
  }

  // Second pass: a kickoff that died before setting remotion_render_id is skipped by the
  // query above (.not('remotion_render_id','is',null)) → it would stay 'rendering' forever,
  // invisible to both the client poll and this cron. Fail any that never got a render id.
  const strandedCutoff = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data: stranded, error: strandedErr } = await service
    .from('video_edits')
    .update({ status: 'failed', error: 'Render did not start — please try again' })
    .eq('status', 'rendering')
    .is('remotion_render_id', null)
    .lt('created_at', strandedCutoff)
    .select('id')
  if (strandedErr) {
    console.error('[cron/reconcile-renders] stranded', strandedErr)
  }

  return NextResponse.json({
    data: { checked: stuck?.length ?? 0, done, failed, pending, stranded: stranded?.length ?? 0 },
  })
}
