import { NextResponse } from 'next/server'
import { addMinutes } from 'date-fns'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { coachCalendarSessionCreateSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`sessions-post:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = coachCalendarSessionCreateSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ')
      return NextResponse.json({ error: msg || 'Invalid input' }, { status: 400 })
    }

    const { clientId, date, startTime, durationMinutes: rawDuration, type, notes } = parsed.data
    const durationMinutes = rawDuration ?? 60

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found or not in your workspace' }, { status: 404 })
    }
    const scheduled = new Date(`${date}T${startTime}:00`)
    const endTime = addMinutes(scheduled, durationMinutes)

    const { data: existing } = await supabase
      .from('sessions')
      .select('id, scheduled_time')
      .eq('coach_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('scheduled_time', scheduled.toISOString())
      .neq('status', 'cancelled')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'That time is taken' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        coach_id: user.id,
        workspace_id: workspaceId,
        client_id: clientId,
        scheduled_time: scheduled.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes,
        session_type: type ?? 'video',
        notes: notes ?? null,
        status: 'confirmed',
      })
      .select('id, scheduled_time, end_time, duration_minutes, status, notes, client_id, clients(first_name, last_name)')
      .single()

    if (error) return NextResponse.json({ error: error.message || 'Could not create session' }, { status: 500 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — check your connection and try again' }, { status: 500 })
  }
}

