import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ assignmentId: string }> }

/**
 * DELETE /api/video-assignments/[assignmentId] — remove direct client access.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { assignmentId } = await context.params
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

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`video-assignments-delete:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { error } = await supabase
      .from('video_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('workspace_id', coach.workspace_id)

    if (error) {
      return NextResponse.json({ error: 'Could not remove access' }, { status: 500 })
    }

    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
