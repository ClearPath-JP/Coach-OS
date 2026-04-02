import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/client/assignments — logged-in client's assignments with template details.
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`client-assignments-get:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
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
      return NextResponse.json({ error: 'Could not load assignments' }, { status: 500 })
    }

    const ids = (rows ?? []).map((r) => r.id)
    const subs: Record<string, unknown[]> = {}
    if (ids.length > 0) {
      const { data: subRows } = await supabase
        .from('assignment_submissions')
        .select(
          'id, client_assignment_id, submission_type, text_content, video_id, file_url, checklist_responses, version, created_at'
        )
        .in('client_assignment_id', ids)
        .order('version', { ascending: false })

      for (const s of subRows ?? []) {
        const aid = s.client_assignment_id as string
        if (!subs[aid]) subs[aid] = []
        subs[aid]!.push(s)
      }
    }

    const data = (rows ?? []).map((r) => ({
      ...r,
      submissions: subs[r.id] ?? [],
    }))

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
