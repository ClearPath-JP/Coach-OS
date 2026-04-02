import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { insertCoachThreadMessageAsCoach } from '@/lib/messages/insert-thread-message'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import {
  type SessionActionItemRow,
  mergeIncomingActionItems,
  parseActionItemsJson,
  toDbRowsFromCoachInput,
} from '@/lib/sessions/action-items'
import { sessionNotesPatchSchema } from '@/lib/validations'

type RouteParams = { params: Promise<{ id: string }> }

const SESSION_NOTES_SELECT =
  'id, client_id, coach_id, workspace_id, scheduled_time, session_summary, coach_private_notes, action_items, notes_sent_at, status'

/**
 * GET /api/sessions/[id]/notes — coach; structured session notes for drawer/cards.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth
    const { id } = await params

    const { data: row, error } = await supabase
      .from('sessions')
      .select(SESSION_NOTES_SELECT)
      .eq('id', id)
      .eq('coach_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Could not load session' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ data: { session: row } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sessions/[id]/notes — coach; structured notes, optional send to client thread.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth
    const { id } = await params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`sessions-notes-patch:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = sessionNotesPatchSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ') || 'Invalid input'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const body = parsed.data

    const { data: existing, error: fetchErr } = await supabase
      .from('sessions')
      .select(SESSION_NOTES_SELECT)
      .eq('id', id)
      .eq('coach_id', user.id)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.coachPrivateNotes !== undefined) {
      updates.coach_private_notes =
        typeof body.coachPrivateNotes === 'string' ? body.coachPrivateNotes.trim() || null : null
    }
    if (typeof body.sessionSummary === 'string') {
      updates.session_summary = body.sessionSummary.trim() || null
    }

    let nextActionJson: SessionActionItemRow[] | null = null
    if (body.actionItems) {
      const prev = parseActionItemsJson(existing.action_items)
      const incoming = toDbRowsFromCoachInput(body.actionItems)
      nextActionJson = mergeIncomingActionItems(prev, incoming)
      updates.action_items = nextActionJson
    }

    const sendToClient = body.sendToClient === true
    const summaryForMessage = (
      typeof body.sessionSummary === 'string' ? body.sessionSummary.trim() : (existing.session_summary ?? '').trim()
    )

    if (sendToClient && !summaryForMessage) {
      return NextResponse.json(
        { error: 'Add a session summary before sending notes to your client' },
        { status: 400 }
      )
    }

    const { data: session, error: updErr } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .eq('coach_id', user.id)
      .select(SESSION_NOTES_SELECT)
      .single()

    if (updErr || !session) {
      return NextResponse.json({ error: 'Could not update session notes' }, { status: 500 })
    }

    if (sendToClient) {
      const itemsForMessage = parseActionItemsJson(session.action_items)
        .filter((i) => i.assigned_to === 'client')
        .map((i) => ({ id: i.id, text: i.text }))

      const payload = JSON.stringify({
        sessionId: session.id,
        summary: summaryForMessage,
        actionItems: itemsForMessage,
        sessionDate: session.scheduled_time,
      })

      const inserted = await insertCoachThreadMessageAsCoach({
        workspaceId: session.workspace_id,
        clientId: session.client_id,
        coachUserId: user.id,
        content: payload,
        messageType: 'session_notes',
        maxContentLength: 8000,
      })
      if (!inserted.ok) {
        return NextResponse.json(
          { error: inserted.error === 'Client has no portal account yet' ? inserted.error : 'Notes saved but could not message your client' },
          { status: inserted.error === 'Client has no portal account yet' ? 400 : 502 }
        )
      }

      const sentAt = new Date().toISOString()
      const { data: sessionAfterSent, error: sentErr } = await supabase
        .from('sessions')
        .update({ notes_sent_at: sentAt, updated_at: sentAt })
        .eq('id', id)
        .eq('coach_id', user.id)
        .select(SESSION_NOTES_SELECT)
        .single()

      if (!sentErr && sessionAfterSent) {
        return NextResponse.json({ data: { session: sessionAfterSent } })
      }
    }

    return NextResponse.json({ data: { session } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
