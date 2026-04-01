import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/assignments/[id] — single client_assignment for coach (status refresh for message cards). */
export async function GET(_request: Request, context: Ctx) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id } = await context.params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-one:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: row, error } = await supabase
      .from('client_assignments')
      .select(
        `
        id,
        status,
        due_at,
        submitted_at,
        reviewed_at,
        coach_feedback,
        points_awarded,
        client_id,
        assignment_templates ( title, assignment_type, points, instructions, checklist_items )
      `
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: subs } = await supabase
      .from('assignment_submissions')
      .select(
        'id, submission_type, text_content, video_id, file_url, checklist_responses, version, created_at'
      )
      .eq('client_assignment_id', id)
      .order('version', { ascending: false })

    return NextResponse.json({ data: { ...row, submissions: subs ?? [] } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
