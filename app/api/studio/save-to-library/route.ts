import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchBunnyVideoFromUrl } from '@/lib/bunny'
import { logServerError } from '@/lib/log-server-error'

export const runtime = 'nodejs'

const schema = z.object({
  editId: z.string().uuid(),
  title: z.string().trim().min(1).max(120).default('My Reel'),
})

/**
 * POST /api/studio/save-to-library
 * Re-ingests a finished render (video_edits.output_url) into Bunny Stream as a
 * new `videos` row so it becomes a reusable library clip.
 * The video_edits row must have status='done' and a non-null output_url.
 * Bunny transcodes asynchronously; the inserted row starts with processing_status='processing'.
 */
export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }
  const { editId, title } = parsed.data

  const service = createServiceClient()

  const { data: edit } = await service
    .from('video_edits')
    .select('id, output_url, status')
    .eq('id', editId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!edit?.output_url || edit.status !== 'done') {
    return NextResponse.json({ error: 'Render not ready' }, { status: 400 })
  }

  try {
    const { guid, libraryId } = await fetchBunnyVideoFromUrl(title, edit.output_url)

    const { data: row, error } = await service
      .from('videos')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title,
        storage_provider: 'bunny',
        bunny_library_id: libraryId,
        bunny_video_guid: guid,
        processing_status: 'processing',
      })
      .select('id')
      .single()

    if (error || !row) throw error ?? new Error('videos insert failed')

    // Record the output guid on the edit so callers can correlate the two rows.
    // Non-fatal: the videos row is already committed; log but don't roll back.
    const { error: updateError } = await service
      .from('video_edits')
      .update({ output_guid: guid })
      .eq('id', editId)
    if (updateError) {
      await logServerError('POST /api/studio/save-to-library — video_edits update', updateError)
    }

    return NextResponse.json({ data: { videoId: row.id } }, { status: 201 })
  } catch (err) {
    await logServerError('POST /api/studio/save-to-library', err)
    return NextResponse.json({ error: 'Could not save to library' }, { status: 500 })
  }
}
