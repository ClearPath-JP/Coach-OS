import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { parseActionItemsJson } from '@/lib/sessions/action-items'
import { sessionActionItemCompleteSchema } from '@/lib/validations'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/sessions/[id]/action-items/complete — client checks off a client-assigned action item.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, supabase, user } = auth
    const { id: sessionId } = await params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`session-action-complete:${user.id}`, {
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

    const parsed = sessionActionItemCompleteSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { actionItemId } = parsed.data

    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('id, client_id, action_items')
      .eq('id', sessionId)
      .eq('client_id', clientId)
      .maybeSingle()

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const items = parseActionItemsJson(session.action_items)
    const idx = items.findIndex((i) => i.id === actionItemId && i.assigned_to === 'client')
    if (idx < 0) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 })
    }

    const current = items[idx]!
    if (current.completed) {
      const done = current
      return NextResponse.json({
        data: {
          actionItem: {
            id: done.id,
            text: done.text,
            assignedTo: 'client' as const,
            completed: true,
            completedAt: done.completed_at,
          },
        },
      })
    }

    const now = new Date().toISOString()
    const next = items.map((i, j) => (j === idx ? { ...i, completed: true, completed_at: now } : i))

    const { error: updErr } = await supabase
      .from('sessions')
      .update({ action_items: next, updated_at: now })
      .eq('id', sessionId)
      .eq('client_id', clientId)

    if (updErr) {
      return NextResponse.json({ error: 'Could not update action item' }, { status: 500 })
    }

    const updated = next[idx]!
    return NextResponse.json({
      data: {
        actionItem: {
          id: updated.id,
          text: updated.text,
          assignedTo: 'client' as const,
          completed: true,
          completedAt: updated.completed_at,
        },
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
