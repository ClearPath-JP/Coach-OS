import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type Ctx = { params: Promise<{ clientId: string }> }

/**
 * GET /api/assignments/client/[clientId] — all assignments + latest submission (coach).
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { clientId } = await context.params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-by-client:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { data: rows, error } = await supabase
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
        created_at,
        assignment_template_id,
        assignment_templates (
          id,
          title,
          instructions,
          assignment_type,
          checklist_items,
          points
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not load assignments' }, { status: 500 })
    }

    const assignmentIds = (rows ?? []).map((r) => r.id)
    const submissionsByAssignment: Record<string, unknown[]> = {}
    if (assignmentIds.length > 0) {
      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select(
          'id, client_assignment_id, submission_type, text_content, video_id, file_url, file_size_bytes, checklist_responses, version, created_at'
        )
        .in('client_assignment_id', assignmentIds)
        .order('version', { ascending: false })

      for (const s of subs ?? []) {
        const aid = s.client_assignment_id as string
        if (!submissionsByAssignment[aid]) submissionsByAssignment[aid] = []
        submissionsByAssignment[aid]!.push(s)
      }
    }

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      submissions: submissionsByAssignment[r.id] ?? [],
    }))

    return NextResponse.json({ data: enriched })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
