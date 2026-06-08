import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { getBunnyVideo, fetchBunnyCaptions, bunnyConfigured } from '@/lib/bunny'

/**
 * GET /api/coach/promote/bunny/status?guid=...
 * Polls Bunny encoding status; when finished, persists URLs on the videos row
 * and returns the transcript (Bunny auto-captions) for display + Phase-2 render.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId } = auth

    if (!bunnyConfigured()) {
      return NextResponse.json({ error: 'Video upload is not configured yet.' }, { status: 503 })
    }

    const guid = new URL(request.url).searchParams.get('guid')?.trim()
    if (!guid) return NextResponse.json({ error: 'Missing guid' }, { status: 400 })

    const v = await getBunnyVideo(guid)
    const service = createServiceClient()

    let captionsText = ''
    let cues: { startMs: number; endMs: number; text: string }[] = []

    if (v.ready) {
      if (v.captionsVttUrl) {
        const c = await fetchBunnyCaptions(v.captionsVttUrl)
        captionsText = c.text
        cues = c.cues
      }
      // Write the "ready" row ONCE. The client polls this endpoint every 4s; without
      // this guard, each poll after the video is ready re-UPDATEs the same row with a
      // fresh processed_at — needless WAL + dead-tuple churn that drains the Disk IO
      // budget. Skip the write when the row is already marked ready.
      const { data: existingRow } = await service
        .from('videos')
        .select('processing_status')
        .eq('workspace_id', workspaceId)
        .eq('bunny_video_guid', guid)
        .maybeSingle()
      if (existingRow?.processing_status !== 'ready') {
        await service
          .from('videos')
          .update({
            processing_status: 'ready',
            playback_url: v.hlsUrl,
            mp4_url: v.mp4Url,
            thumbnail_url: v.thumbnailUrl,
            captions_vtt_url: v.captionsVttUrl,
            duration_seconds: v.durationSeconds,
            processed_at: new Date().toISOString(),
            // Reconcile the storage meter against Bunny's real encoded size (the create-time
            // size is client-reported); the recalc trigger then fixes workspace usage.
            ...(v.storageSizeBytes ? { file_size_bytes: v.storageSizeBytes } : {}),
          })
          .eq('workspace_id', workspaceId)
          .eq('bunny_video_guid', guid)
      }
    } else if (v.failed) {
      await service
        .from('videos')
        .update({ processing_status: 'failed' })
        .eq('workspace_id', workspaceId)
        .eq('bunny_video_guid', guid)
    }

    return NextResponse.json({ data: { ...v, captionsText, cues } })
  } catch (err) {
    console.error('GET /api/coach/promote/bunny/status', err)
    return NextResponse.json({ error: 'Could not check upload status' }, { status: 500 })
  }
}
