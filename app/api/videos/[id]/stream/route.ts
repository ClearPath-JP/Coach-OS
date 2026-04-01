import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getValidAccessToken } from '@/lib/google-drive'
import { verifyStreamToken } from '@/lib/stream-token'
import { getVideoStreamRow, userCanStreamVideo } from '@/lib/video-stream-access'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/videos/[id]/stream — proxy from Google Drive or pass-through range request to legacy playback URL.
 * Optional ?token= from POST .../token for repeat Range requests.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: videoId } = await context.params
    const url = new URL(request.url)
    const qpToken = url.searchParams.get('token')?.trim() || ''

    let authUserId: string | null = null
    let sessionEmail: string | null = null
    let tokenEmail: string | null = null

    if (qpToken) {
      const payload = verifyStreamToken(qpToken)
      if (!payload || payload.videoId !== videoId) {
        return NextResponse.json({ error: 'Invalid or expired playback link' }, { status: 401 })
      }
      authUserId = payload.userId
      tokenEmail = payload.email ?? null
    } else {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      authUserId = user.id
      sessionEmail = user.email ?? null
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const video = await getVideoStreamRow(videoId)
    const driveId = video?.drive_file_id?.trim() || null
    const playbackUrl = video?.playback_url?.trim() || null

    if (!video || (!driveId && !playbackUrl)) {
      return NextResponse.json(
        { error: "We couldn't find that video — it may have been deleted" },
        { status: 404 }
      )
    }

    const allowed = await userCanStreamVideo(authUserId, video.id, video.workspace_id, {
      tokenEmail,
      sessionEmail,
    })
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const range = request.headers.get('range')

    if (driveId) {
      const accessToken = await getValidAccessToken(video.workspace_id)
      if (!accessToken) {
        return NextResponse.json(
          { error: 'Video source disconnected. Coach needs to reconnect Google Drive.' },
          { status: 401 }
        )
      }

      const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media`
      const driveHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      }
      if (range) driveHeaders.Range = range

      const driveResponse = await fetch(driveUrl, { headers: driveHeaders })

      const outHeaders = new Headers()
      const copy = ['content-type', 'content-length', 'content-range', 'accept-ranges']
      for (const h of copy) {
        const v = driveResponse.headers.get(h)
        if (v) outHeaders.set(h, v)
      }
      if (!outHeaders.has('content-type')) {
        outHeaders.set('Content-Type', 'video/mp4')
      }
      outHeaders.set('Accept-Ranges', 'bytes')
      outHeaders.set('Cache-Control', 'private, max-age=3600')

      return new Response(driveResponse.body, {
        status: driveResponse.status,
        headers: outHeaders,
      })
    }

    const legacyHeaders: Record<string, string> = {}
    if (range) legacyHeaders.Range = range
    const r = await fetch(playbackUrl as string, { headers: legacyHeaders })

    const outHeaders = new Headers()
    const copy = ['content-type', 'content-length', 'content-range', 'accept-ranges']
    for (const h of copy) {
      const v = r.headers.get(h)
      if (v) outHeaders.set(h, v)
    }
    if (!outHeaders.has('content-type')) {
      outHeaders.set('Content-Type', 'video/mp4')
    }
    if (!outHeaders.has('Accept-Ranges')) outHeaders.set('Accept-Ranges', 'bytes')
    outHeaders.set('Cache-Control', 'private, max-age=3600')

    return new Response(r.body, { status: r.status, headers: outHeaders })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
