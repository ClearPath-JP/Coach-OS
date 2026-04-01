import { NextResponse } from 'next/server'
import { addMinutes } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { updateSessionSchema } from '@/lib/validations'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`sessions-patch:${user.id}`, {
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

    const parsed = updateSessionSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ') || 'Invalid input'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const patch = parsed.data
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    const { data: current, error: fetchErr } = await supabase
      .from('sessions')
      .select('scheduled_time, duration_minutes, status')
      .eq('id', id)
      .eq('coach_id', user.id)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (current.status === 'completed') {
      if (typeof patch.durationMinutes === 'number' || (patch.date && patch.startTime)) {
        return NextResponse.json(
          { error: 'Cannot change date, time, or duration for a completed session' },
          { status: 400 }
        )
      }
    }

    if (typeof patch.notes !== 'undefined') updates.notes = patch.notes
    if (patch.status) updates.status = patch.status
    if (typeof patch.paid === 'boolean') {
      updates.paid_at = patch.paid ? new Date().toISOString() : null
    }

    const hasNewStart = Boolean(patch.date && patch.startTime)
    const newStart = hasNewStart ? new Date(`${patch.date}T${patch.startTime}:00`) : new Date(current.scheduled_time)
    const duration =
      typeof patch.durationMinutes === 'number' ? patch.durationMinutes : (current.duration_minutes ?? 60)

    if (typeof patch.durationMinutes === 'number') {
      updates.duration_minutes = patch.durationMinutes
    }
    if (hasNewStart) {
      updates.scheduled_time = newStart.toISOString()
    }

    const scheduleAffectsEnd = hasNewStart || typeof patch.durationMinutes === 'number'
    if (scheduleAffectsEnd) {
      updates.end_time = addMinutes(newStart, duration).toISOString()
    }

    if (scheduleAffectsEnd && current.status !== 'completed') {
      const { data: others } = await supabase
        .from('sessions')
        .select('id, scheduled_time, end_time, duration_minutes')
        .eq('coach_id', user.id)
        .neq('id', id)
        .in('status', ['pending', 'confirmed'])

      const windowStart = newStart
      const windowEnd = addMinutes(newStart, duration)
      const hasOverlap = (others ?? []).some((s) => {
        const sStart = new Date(s.scheduled_time)
        const sEnd = s.end_time ? new Date(s.end_time) : addMinutes(sStart, s.duration_minutes ?? 60)
        return sEnd > windowStart && windowEnd > sStart
      })
      if (hasOverlap) {
        return NextResponse.json({ error: 'That time overlaps another session' }, { status: 409 })
      }
    }

    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .eq('coach_id', user.id)
      .select('id, scheduled_time, end_time, duration_minutes, status, notes, client_id, clients(first_name, last_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Could not update session' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — check your connection and try again' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`sessions-delete:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: row } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', id)
      .eq('coach_id', user.id)
      .maybeSingle()

    if (!row) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (row.status === 'completed') {
      return NextResponse.json({ error: 'Completed sessions cannot be removed from the calendar' }, { status: 400 })
    }

    const { error } = await supabase.from('sessions').delete().eq('id', id).eq('coach_id', user.id)
    if (error) {
      return NextResponse.json({ error: 'Could not delete session' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — check your connection and try again' }, { status: 500 })
  }
}
