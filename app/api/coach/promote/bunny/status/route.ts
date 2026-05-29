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
        })
        .eq('workspace_id', workspaceId)
        .eq('bunny_video_guid', guid)
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
