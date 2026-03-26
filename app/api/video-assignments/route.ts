import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createVideoAssignmentSchema } from '@/lib/validations'

/**
 * POST /api/video-assignments — grant a client direct access to a video.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`video-assignments-post:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const raw = await request.json()
    const parsed = createVideoAssignmentSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { videoId, clientId } = parsed.data

    const { data: v } = await supabase
      .from('videos')
      .select('id')
      .eq('id', videoId)
      .eq('workspace_id', coach.workspace_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!v) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const { data: cl } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()
    if (!cl) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('video_assignments')
      .select('id')
      .eq('video_id', videoId)
      .eq('client_id', clientId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ data: { id: existing.id } })
    }

    const { data: row, error } = await supabase
      .from('video_assignments')
      .insert({
        video_id: videoId,
        client_id: clientId,
        workspace_id: coach.workspace_id,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Could not assign video' }, { status: 500 })
    }

    return NextResponse.json({ data: { id: row.id } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
