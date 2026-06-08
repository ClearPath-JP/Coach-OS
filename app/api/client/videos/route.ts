import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { signBunnyUrl } from '@/lib/bunny'

/**
 * GET /api/client/videos
 *
 * The coach-shared video library for this client's workspace: ready, non-deleted videos with
 * shared_with_clients = true. Uses the service role with an explicit shared filter so only
 * shared videos are ever listed. Playback is still gated per-video by the token route
 * (clientCanAccessVideo now allows shared videos).
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-videos-get:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests — please wait a moment' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('videos')
      .select('id, title, description, category, thumbnail_url, duration_seconds, created_at')
      .eq('workspace_id', workspaceId)
      .eq('shared_with_clients', true)
      .eq('processing_status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/client/videos', error)
      return NextResponse.json({ error: 'Could not load videos' }, { status: 500 })
    }

    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((v) => {
      const thumb = typeof v.thumbnail_url === 'string' && v.thumbnail_url ? v.thumbnail_url : null
      return { ...v, thumbnail_url: thumb ? signBunnyUrl(thumb) : thumb }
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET /api/client/videos', err)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
