import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { signStreamToken } from '@/lib/stream-token'
import { getVideoStreamRow, userCanStreamVideo } from '@/lib/video-stream-access'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/videos/[id]/token — short-lived signed URL for the stream proxy (reduces auth work on Range requests).
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: videoId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
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

    const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle()
    const sessionEmail = user.email ?? profile?.email ?? null

    const allowed = await userCanStreamVideo(user.id, video.id, video.workspace_id, { sessionEmail })
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { token, expiresAt } = signStreamToken(videoId, user.id, 3600, sessionEmail)
    const streamUrl = `/api/videos/${videoId}/stream?token=${encodeURIComponent(token)}`

    return NextResponse.json({
      data: {
        streamUrl,
        expiresAt: new Date(expiresAt).toISOString(),
        token,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
