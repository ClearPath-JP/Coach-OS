import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { parseActionItemsJson } from '@/lib/sessions/action-items'

type RouteParams = { params: Promise<{ sessionId: string }> }

/**
 * GET /api/client/sessions/[sessionId]/session-notes — recap + client action items (live completion state).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, supabase } = auth
    const { sessionId } = await params

    const { data: row, error } = await supabase
      .from('sessions')
      .select('id, scheduled_time, session_summary, action_items, notes_sent_at')
      .eq('id', sessionId)
      .eq('client_id', clientId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Could not load session' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const clientItems = parseActionItemsJson(row.action_items).filter((i) => i.assigned_to === 'client')

    return NextResponse.json({
      data: {
        sessionId: row.id,
        scheduledTime: row.scheduled_time,
        sessionSummary: row.session_summary,
        notesSentAt: row.notes_sent_at,
        actionItems: clientItems.map((i) => ({
          id: i.id,
          text: i.text,
          assignedTo: 'client' as const,
          completed: i.completed,
          completedAt: i.completed_at,
        })),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
