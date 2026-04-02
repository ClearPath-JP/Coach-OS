import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { parseActionItemsJson } from '@/lib/sessions/action-items'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/clients/[id]/session-notes-history — last sessions with shared or saved recap notes (coach).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth
    const { id: clientId } = await params

    const { data: client, error: cErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (cErr || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { data: rows, error } = await supabase
      .from('sessions')
      .select(
        'id, scheduled_time, session_summary, coach_private_notes, action_items, notes_sent_at'
      )
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .order('scheduled_time', { ascending: false })
      .limit(40)

    if (error) {
      return NextResponse.json({ error: 'Could not load sessions' }, { status: 500 })
    }

    const withNotes = (rows ?? []).filter(
      (r) =>
        (typeof r.session_summary === 'string' && r.session_summary.trim().length > 0) ||
        r.notes_sent_at != null
    )

    const sliced = withNotes.slice(0, 3).map((r) => {
      const items = parseActionItemsJson(r.action_items)
      const clientItems = items.filter((i) => i.assigned_to === 'client')
      const done = clientItems.filter((i) => i.completed).length
      return {
        sessionId: r.id,
        scheduledTime: r.scheduled_time,
        sessionSummary: r.session_summary,
        notesSentAt: r.notes_sent_at,
        actionItemsTotal: clientItems.length,
        actionItemsCompleted: done,
        actionItems: clientItems,
      }
    })

    return NextResponse.json({ data: { sessions: sliced } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
