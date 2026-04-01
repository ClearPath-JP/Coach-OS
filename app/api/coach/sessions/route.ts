import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createSessionSchema } from '@/lib/validations'
import { normalizeEmail } from '@/lib/utils'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { addMinutes } from 'date-fns'

/**
 * GET /api/coach/sessions — list coach sessions. Coach only.
 * Optional query: `from` and `to` (ISO datetimes) — sessions in that range (pending/confirmed), including past.
 * Without params: upcoming only from now through ~12 weeks (dashboard / default).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    let rangeFrom: string
    let rangeTo: string
    if (fromParam && toParam) {
      const fromT = new Date(fromParam)
      const toT = new Date(toParam)
      if (Number.isNaN(fromT.getTime()) || Number.isNaN(toT.getTime())) {
        return NextResponse.json({ error: 'Invalid from or to date' }, { status: 400 })
      }
      rangeFrom = fromT.toISOString()
      rangeTo = toT.toISOString()
    } else {
      rangeFrom = new Date().toISOString()
      const twelveWeeks = new Date()
      twelveWeeks.setDate(twelveWeeks.getDate() + 84)
      rangeTo = twelveWeeks.toISOString()
    }

    const statuses = fromParam && toParam
      ? ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']
      : ['pending', 'confirmed']

    const { data } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status, notes, client_id, clients(first_name, last_name)')
      .eq('coach_id', user.id)
      .eq('workspace_id', coach.workspace_id)
      .gte('scheduled_time', rangeFrom)
      .lte('scheduled_time', rangeTo)
      .in('status', statuses)
      .order('scheduled_time', { ascending: true })
      .limit(400)
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/coach/sessions — create a session (coach only).
 * Body: client_id, scheduled_time (ISO), duration_minutes (optional, default 60), notes, availability_slot_id, session_product_id, status (optional, default 'confirmed').
 * Returns 200 { data: { id, conflict?: true } } or 400/403/409 (conflict = overlapping session).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`coach-sessions-post:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ')
      return NextResponse.json({ error: msg || 'Validation failed' }, { status: 400 })
    }

    const { client_id, scheduled_time, duration_minutes = 60, notes, availability_slot_id, session_product_id, status } = parsed.data
    const start = new Date(scheduled_time)
    const end = addMinutes(start, duration_minutes)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found or not in your workspace' }, { status: 404 })
    }

    const { data: existingSessions } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes')
      .eq('coach_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .lt('scheduled_time', endIso)

    const hasOverlap = (existingSessions ?? []).some((s) => {
      const sStart = new Date(s.scheduled_time)
      const sEnd = s.end_time ? new Date(s.end_time) : addMinutes(sStart, s.duration_minutes ?? 60)
      return sEnd > start
    })
    if (hasOverlap) {
      return NextResponse.json(
        { error: 'You already have a session at this time', conflict: true },
        { status: 409 }
      )
    }

    const { data: inserted, error } = await supabase
      .from('sessions')
      .insert({
        coach_id: user.id,
        client_id,
        workspace_id: coach.workspace_id,
        scheduled_time: startIso,
        end_time: endIso,
        duration_minutes,
        status,
        notes: notes ?? null,
        availability_slot_id: availability_slot_id ?? null,
        session_product_id: session_product_id ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create session' },
        { status: 500 }
      )
    }

    const { data: clientForMessage } = await supabase
      .from('clients')
      .select('email')
      .eq('id', client_id)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    if (clientForMessage?.email) {
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizeEmail(clientForMessage.email))
        .maybeSingle()

      if (clientProfile?.id) {
        const sessionCard = JSON.stringify({
          type: 'session',
          sessionId: inserted.id,
          scheduledTime: startIso,
          endTime: endIso,
          durationMinutes: duration_minutes,
          status,
          notes: notes ?? null,
        })
        await supabase.from('messages').insert({
          workspace_id: coach.workspace_id,
          sender_id: user.id,
          recipient_id: clientProfile.id,
          client_id,
          content: sessionCard,
          message_type: 'session',
        })
      }
    }

    return NextResponse.json({ data: { id: inserted.id } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
