import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { getCaptionedRenderStatus, remotionConfigured } from '@/lib/remotion'

export const runtime = 'nodejs'

/**
 * GET /api/coach/promote/render/status?editId=...
 * Polls the Lambda render progress for a video_edits job; persists the result on
 * done/failed and returns { status, progress (0..1), outputUrl, error }.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId } = auth

    if (!remotionConfigured()) {
      return NextResponse.json({ error: 'Rendering is not set up yet.' }, { status: 503 })
    }

    const editId = new URL(request.url).searchParams.get('editId')?.trim()
    if (!editId) return NextResponse.json({ error: 'Missing editId' }, { status: 400 })

    const service = createServiceClient()
    const { data: edit, error } = await service
      .from('video_edits')
      .select('id, status, remotion_render_id, remotion_bucket, output_url, error, project_id')
      .eq('id', editId)
      .eq('workspace_id', workspaceId)
      .single()
    if (error || !edit) return NextResponse.json({ error: 'Render not found' }, { status: 404 })

    // Terminal states are cached — no need to hit Lambda again.
    if (edit.status === 'done' || edit.status === 'failed') {
      return NextResponse.json({
        data: { status: edit.status, progress: edit.status === 'done' ? 1 : 0, outputUrl: edit.output_url, error: edit.error },
      })
    }
    if (!edit.remotion_render_id || !edit.remotion_bucket) {
      return NextResponse.json({ data: { status: edit.status, progress: 0, outputUrl: null, error: null } })
    }

    const s = await getCaptionedRenderStatus(edit.remotion_render_id, edit.remotion_bucket)

    if (s.done && s.outputUrl) {
      await service
        .from('video_edits')
        .update({ status: 'done', output_url: s.outputUrl, completed_at: new Date().toISOString() })
        .eq('id', editId)
        .eq('workspace_id', workspaceId)
      if (edit.project_id) {
        await service.from('video_projects')
          .update({ status: 'rendered', updated_at: new Date().toISOString() })
          .eq('id', edit.project_id).eq('workspace_id', workspaceId)
      }
      return NextResponse.json({ data: { status: 'done', progress: 1, outputUrl: s.outputUrl, error: null } })
    }
    if (s.error) {
      await service
        .from('video_edits')
        .update({ status: 'failed', error: s.error.slice(0, 500) })
        .eq('id', editId)
        .eq('workspace_id', workspaceId)
      if (edit.project_id) {
        await service.from('video_projects')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', edit.project_id).eq('workspace_id', workspaceId)
      }
      return NextResponse.json({ data: { status: 'failed', progress: s.progress, outputUrl: null, error: s.error } })
    }

    return NextResponse.json({ data: { status: 'rendering', progress: s.progress, outputUrl: null, error: null } })
  } catch (err) {
    console.error('GET /api/coach/promote/render/status', err)
    return NextResponse.json({ error: 'Could not check render status' }, { status: 500 })
  }
}
