import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types — columns added by 20260601010000_classes_overhaul.sql migration.
// Cast via `unknown` because generated Supabase types may lag behind.
// ---------------------------------------------------------------------------

interface ClassSlot {
  id: string
  class_group_id: string | null
  workspace_id: string
  day_of_week: number
  one_time_date: string | null
}

interface SessionRow {
  id: string
  client_id: string | null
  scheduled_time: string
  paid_at: string | null
  created_at: string
  attended: boolean | null
  workspace_id: string
}

interface ClientRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  profile_photo_url: string | null
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const attendancePatchSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a UUID'),
  attended: z.boolean(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get weekday (0=Sun … 6=Sat) from a YYYY-MM-DD string (UTC). */
function weekdayFromDate(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay()
}

/**
 * Resolve which recurring_availability slot in the group handles a given date.
 * For a one-time class: match the slot whose one_time_date equals the date.
 * For a recurring class: match the slot whose day_of_week equals the date's weekday.
 */
function resolveSlotForDate(slots: ClassSlot[], dateStr: string): ClassSlot | undefined {
  const targetDow = weekdayFromDate(dateStr)
  return (
    slots.find((s) => s.one_time_date === dateStr) ??
    slots.find((s) => s.one_time_date == null && s.day_of_week === targetDow)
  )
}

// ---------------------------------------------------------------------------
// GET /api/coach/classes/[id]/bookings?date=YYYY-MM-DD
// Returns the roster for a single occurrence (paid bookings only) + clientIds list.
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classGroupId } = await params
    if (!classGroupId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(
      `classes-bookings-get:${user.id}`,
      { windowMs: 60_000, max: 120 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again in a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: 'Query param date (YYYY-MM-DD) is required' },
        { status: 400 }
      )
    }

    const svc = createServiceClient()

    // 1. Load all slots in the group and verify workspace ownership
    const { data: rawSlots, error: slotsErr } = await svc
      .from('recurring_availability')
      .select('id, class_group_id, workspace_id, day_of_week, one_time_date')
      .eq('class_group_id', classGroupId)

    if (slotsErr || !rawSlots || rawSlots.length === 0) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const slots = rawSlots as unknown as ClassSlot[]

    // Ownership check — all slots must belong to the caller's workspace
    if (slots.some((s) => s.workspace_id !== workspaceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Find the slot that corresponds to the requested date
    const matchedSlot = resolveSlotForDate(slots, dateParam)
    if (!matchedSlot) {
      return NextResponse.json(
        { error: 'No slot in this class group matches the requested date' },
        { status: 404 }
      )
    }

    // 3. Fetch paid sessions for that slot on that date
    //    scheduled_time::date = dateParam  →  gte/lt on the full day window
    const dayStart = `${dateParam}T00:00:00.000Z`
    const dayEnd = `${dateParam}T23:59:59.999Z`

    const { data: rawSessions, error: sessErr } = await svc
      .from('sessions')
      .select('id, client_id, scheduled_time, paid_at, created_at, attended, workspace_id')
      .eq('recurring_availability_id', matchedSlot.id)
      .gte('scheduled_time', dayStart)
      .lte('scheduled_time', dayEnd)
      .not('paid_at', 'is', null)

    if (sessErr) {
      console.error('GET /api/coach/classes/[id]/bookings sessions', sessErr)
      return NextResponse.json({ error: 'Could not load bookings' }, { status: 500 })
    }

    const sessions = (rawSessions ?? []) as unknown as SessionRow[]

    if (sessions.length === 0) {
      return NextResponse.json({
        data: { roster: [], clientIds: [] },
      })
    }

    // 4. Load client info for every client_id in the roster
    const clientIds = [...new Set(sessions.map((s) => s.client_id).filter((id): id is string => id != null))]

    const clientMap = new Map<string, ClientRow>()
    if (clientIds.length > 0) {
      const { data: rawClients, error: clientErr } = await svc
        .from('clients')
        .select('id, first_name, last_name, email, profile_photo_url')
        .in('id', clientIds)
        .eq('workspace_id', workspaceId)

      if (clientErr) {
        console.error('GET /api/coach/classes/[id]/bookings clients', clientErr)
        return NextResponse.json({ error: 'Could not load client info' }, { status: 500 })
      }

      for (const c of (rawClients ?? []) as unknown as ClientRow[]) {
        clientMap.set(c.id, c)
      }
    }

    // 5. Build roster array
    const roster = sessions.map((s) => {
      const c = s.client_id ? clientMap.get(s.client_id) : undefined
      const firstName = c?.first_name ?? ''
      const lastName = c?.last_name ?? ''
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
      return {
        sessionId: s.id,
        clientId: s.client_id,
        name,
        email: c?.email ?? null,
        photoUrl: c?.profile_photo_url ?? null,
        bookedAt: s.created_at,
        attended: s.attended ?? null,
      }
    })

    return NextResponse.json({
      data: {
        roster,
        clientIds,
      },
    })
  } catch (err) {
    console.error('GET /api/coach/classes/[id]/bookings', err)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/coach/classes/[id]/bookings
// Body: { sessionId: string, attended: boolean }
// Marks attendance on a single booking after verifying workspace ownership.
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classGroupId } = await params
    if (!classGroupId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(
      `classes-bookings-patch:${user.id}`,
      { windowMs: 60_000, max: 120 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again in a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = attendancePatchSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { sessionId, attended } = parsed.data

    // Use service client for the write (bypasses RLS)
    const svc = createServiceClient()

    // 1. Verify the session belongs to the caller's workspace before writing.
    //    We also confirm the session links to a slot in this class group.
    const { data: rawSession, error: fetchErr } = await svc
      .from('sessions')
      .select('id, workspace_id, recurring_availability_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (fetchErr || !rawSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = rawSession as unknown as { id: string; workspace_id: string; recurring_availability_id: string | null }

    // Workspace ownership check
    if (session.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Confirm the session's slot belongs to the requested class group
    if (session.recurring_availability_id) {
      const { data: slotCheck } = await svc
        .from('recurring_availability')
        .select('class_group_id')
        .eq('id', session.recurring_availability_id)
        .maybeSingle()

      const slotGroupId = (slotCheck as unknown as { class_group_id: string | null } | null)?.class_group_id
      if (slotGroupId !== classGroupId) {
        return NextResponse.json(
          { error: 'Session does not belong to this class group' },
          { status: 403 }
        )
      }
    }

    // 2. Write attendance — service client bypasses RLS
    const { error: updateErr } = await svc
      .from('sessions')
      .update({
        attended,
        attendance_marked_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', sessionId)

    if (updateErr) {
      console.error('PATCH /api/coach/classes/[id]/bookings attendance', updateErr)
      return NextResponse.json({ error: 'Could not update attendance' }, { status: 500 })
    }

    return NextResponse.json({ data: { sessionId, attended } })
  } catch (err) {
    console.error('PATCH /api/coach/classes/[id]/bookings', err)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
