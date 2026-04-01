import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/** GET /api/assignments/all — workspace-wide assignments for coach table. */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-all:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data, error } = await supabase
      .from('client_assignments')
      .select(
        `
        id,
        assignment_template_id,
        status,
        due_at,
        submitted_at,
        points_awarded,
        created_at,
        client_id,
        clients ( first_name, last_name ),
        assignment_templates ( title, assignment_type, points )
      `
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not load' }, { status: 500 })
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
