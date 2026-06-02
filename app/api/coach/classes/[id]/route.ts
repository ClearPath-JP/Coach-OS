import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { patchClassSchema } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Types for columns added by the classes-overhaul migration (not yet in
// generated Supabase types — cast via `unknown` where needed).
// ---------------------------------------------------------------------------

interface ClassSlot {
  id: string
  class_group_id: string | null
  name: string | null
  location: string | null
  color: string | null
  status: string
  member_access: string
  day_of_week: number
  one_time_date: string | null
  start_time: string
  end_time: string
  session_product_id: string | null
  workspace_id: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add durationMinutes to a "HH:MM" string → "HH:MM" (clamped to 23:59). */
function addMinutesToTime(startTime: string, durationMinutes: number): string {
  const parts = startTime.split(':')
  const h = Number(parts[0] ?? 0)
  const m = Number(parts[1] ?? 0)
  const totalMinutes = h * 60 + m + durationMinutes
  const endH = Math.min(Math.floor(totalMinutes / 60), 23)
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

/** Minutes between two "HH:MM" times (end - start). */
function minutesBetween(start: string, end: string): number {
  const s = start.split(':')
  const e = end.split(':')
  const sMin = Number(s[0] ?? 0) * 60 + Number(s[1] ?? 0)
  const eMin = Number(e[0] ?? 0) * 60 + Number(e[1] ?? 0)
  return eMin - sMin
}

/** Weekday Mon=0 … Sun=6 from a YYYY-MM-DD string, matching recurring_availability.day_of_week. */
function weekdayFromDate(dateStr: string): number {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7
}

// ---------------------------------------------------------------------------
// Auth + ownership guard
// ---------------------------------------------------------------------------

type ResolvedGroup =
  | { slots: ClassSlot[]; packageId: string | null; svc: ReturnType<typeof createServiceClient> }
  | { notFound: true }
  | { forbidden: true }

async function resolveGroup(classGroupId: string, workspaceId: string): Promise<ResolvedGroup> {
  const svc = createServiceClient()

  const { data: rawSlots, error } = await svc
    .from('recurring_availability')
    .select('*')
    .eq('class_group_id', classGroupId)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  if (error || !rawSlots || rawSlots.length === 0) {
    return { notFound: true }
  }

  const slots = rawSlots as unknown as ClassSlot[]

  // Ownership check: all slots must belong to the coach's workspace
  if (slots.some((s) => s.workspace_id !== workspaceId)) {
    return { forbidden: true }
  }

  const packageId = slots[0]?.session_product_id ?? null
  return { slots, packageId, svc }
}

// ---------------------------------------------------------------------------
// PATCH /api/coach/classes/[id]  ([id] = class_group_id)
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

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `classes-patch:${user.id}`,
      { windowMs: 60_000, max: 60 }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again shortly' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = patchClassSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const resolved = await resolveGroup(classGroupId, workspaceId)
    if ('notFound' in resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('forbidden' in resolved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { slots, packageId, svc } = resolved
    const d = parsed.data

    // ------------------------------------------------------------------
    // scope: 'all'  — update every slot in the group + the package
    // ------------------------------------------------------------------
    if (d.scope === 'all') {
      // Build slot updates
      const slotUpdates: Record<string, unknown> = {}
      if (d.name !== undefined) slotUpdates.name = d.name
      if (d.location !== undefined) slotUpdates.location = d.location ?? null
      if (d.color !== undefined) slotUpdates.color = d.color ?? null
      if (d.status !== undefined) slotUpdates.status = d.status
      if (d.memberAccess !== undefined) slotUpdates.member_access = d.memberAccess
      if (d.startTime !== undefined) slotUpdates.start_time = d.startTime
      // Recompute end_time whenever start OR duration changes, so the stored
      // duration never goes stale (e.g. a PATCH that sends startTime alone).
      if (d.startTime !== undefined || d.durationMinutes !== undefined) {
        const baseSlot = slots[0]
        const startForCalc = d.startTime ?? baseSlot?.start_time
        const durForCalc =
          d.durationMinutes ??
          (baseSlot ? minutesBetween(baseSlot.start_time, baseSlot.end_time) : undefined)
        if (startForCalc && durForCalc !== undefined) {
          slotUpdates.end_time = addMinutesToTime(startForCalc, durForCalc)
        }
      }

      // Build package updates
      const pkgUpdates: Record<string, unknown> = {}
      if (d.name !== undefined) pkgUpdates.title = d.name
      if (d.description !== undefined) pkgUpdates.description = d.description ?? null
      if (d.type !== undefined) pkgUpdates.session_type = d.type
      if (d.priceCents !== undefined) pkgUpdates.price_cents = d.priceCents
      if (d.currency !== undefined) pkgUpdates.currency = d.currency
      if (d.durationMinutes !== undefined) pkgUpdates.duration_minutes = d.durationMinutes
      if (d.capacity !== undefined) pkgUpdates.capacity = d.capacity
      if (d.isVirtual !== undefined) pkgUpdates.is_virtual = d.isVirtual

      // Reconcile days if requested
      if (d.days !== undefined) {
        const newDays = [...new Set(d.days)].sort((a, b) => a - b)
        const existingDays = slots
          .filter((s) => s.one_time_date == null)
          .map((s) => s.day_of_week)

        const toAdd = newDays.filter((day) => !existingDays.includes(day))
        const toRemove = existingDays.filter((day) => !newDays.includes(day))

        // Soft-remove slots for dropped days
        if (toRemove.length > 0) {
          const removeIds = slots
            .filter((s) => s.one_time_date == null && toRemove.includes(s.day_of_week))
            .map((s) => s.id)
          if (removeIds.length > 0) {
            const { error: rmErr } = await svc
              .from('recurring_availability')
              .update({ is_active: false, status: 'draft' })
              .in('id', removeIds)
            if (rmErr) {
              return NextResponse.json({ error: 'Could not remove day slots' }, { status: 500 })
            }
          }
        }

        // Add slots for new days
        if (toAdd.length > 0) {
          const baseSlot = slots[0]!
          const startT = (d.startTime ?? baseSlot.start_time) as string
          const durMin = d.durationMinutes ?? null
          const endT = durMin != null
            ? addMinutesToTime(startT, durMin)
            : baseSlot.end_time

          const newRows = toAdd.map((day) => ({
            workspace_id: workspaceId,
            coach_id: user.id,
            class_group_id: classGroupId,
            day_of_week: day,
            one_time_date: null,
            start_time: startT,
            end_time: endT,
            name: d.name ?? baseSlot.name,
            location: d.location !== undefined ? (d.location ?? null) : baseSlot.location,
            color: d.color !== undefined ? (d.color ?? null) : baseSlot.color,
            status: d.status ?? baseSlot.status,
            member_access: d.memberAccess ?? baseSlot.member_access,
            session_product_id: packageId,
            is_client_bookable: true,
            is_active: true,
          }))

          const { error: addErr } = await svc.from('recurring_availability').insert(newRows)
          if (addErr) {
            return NextResponse.json({ error: 'Could not add new day slots' }, { status: 500 })
          }
        }
      }

      // Apply slot updates to all existing active slots in the group
      if (Object.keys(slotUpdates).length > 0) {
        const allIds = slots.map((s) => s.id)
        const { error: slotErr } = await svc
          .from('recurring_availability')
          .update(slotUpdates)
          .in('id', allIds)
        if (slotErr) {
          return NextResponse.json({ error: 'Could not update class slots' }, { status: 500 })
        }
      }

      // Apply package updates
      if (packageId && Object.keys(pkgUpdates).length > 0) {
        const { error: pkgErr } = await svc
          .from('session_packages')
          .update(pkgUpdates)
          .eq('id', packageId)
        if (pkgErr) {
          return NextResponse.json({ error: 'Could not update class package' }, { status: 500 })
        }
      }

      return NextResponse.json({ data: { classGroupId, updated: 'all' } })
    }

    // ------------------------------------------------------------------
    // scope: 'occurrence'  — upsert a class_occurrence_overrides row
    // ------------------------------------------------------------------
    const occurrenceDate = d.occurrenceDate! // validated present by zod superRefine
    const targetDow = weekdayFromDate(occurrenceDate)

    // Find the slot in the group whose weekday matches (or the one-time slot)
    const matchedSlot =
      slots.find((s) => s.one_time_date === occurrenceDate) ??
      slots.find((s) => s.one_time_date == null && s.day_of_week === targetDow)

    if (!matchedSlot) {
      return NextResponse.json(
        { error: 'No slot in this class group matches the occurrence date' },
        { status: 404 }
      )
    }

    // Build override fields
    const overrideFields: Record<string, unknown> = {
      workspace_id: workspaceId,
      recurring_availability_id: matchedSlot.id,
      occurrence_date: occurrenceDate,
      canceled: false,
    }
    if (d.startTime !== undefined) overrideFields.start_time = d.startTime
    if (d.capacity !== undefined) overrideFields.capacity = d.capacity
    if (d.location !== undefined) overrideFields.location = d.location ?? null

    const { data: override, error: ovErr } = await svc
      .from('class_occurrence_overrides')
      .upsert(overrideFields, { onConflict: 'recurring_availability_id,occurrence_date' })
      .select()
      .single()

    if (ovErr) {
      return NextResponse.json({ error: 'Could not save occurrence override' }, { status: 500 })
    }

    return NextResponse.json({ data: { classGroupId, scope: 'occurrence', override } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/coach/classes/[id]?scope=all|occurrence&date=YYYY-MM-DD
// ---------------------------------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classGroupId } = await params
    if (!classGroupId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `classes-delete:${user.id}`,
      { windowMs: 60_000, max: 30 }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again shortly' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')
    const dateParam = url.searchParams.get('date')

    if (scope !== 'all' && scope !== 'occurrence') {
      return NextResponse.json(
        { error: 'Query param scope must be "all" or "occurrence"' },
        { status: 400 }
      )
    }
    if (scope === 'occurrence' && !dateParam) {
      return NextResponse.json(
        { error: 'Query param date (YYYY-MM-DD) required for scope=occurrence' },
        { status: 400 }
      )
    }

    const resolved = await resolveGroup(classGroupId, workspaceId)
    if ('notFound' in resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('forbidden' in resolved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { slots, packageId, svc } = resolved

    // ------------------------------------------------------------------
    // scope: 'all'  — soft-delete the entire group
    // ------------------------------------------------------------------
    if (scope === 'all') {
      const allIds = slots.map((s) => s.id)

      const { error: slotErr } = await svc
        .from('recurring_availability')
        .update({ is_active: false, status: 'draft' })
        .in('id', allIds)

      if (slotErr) {
        return NextResponse.json({ error: 'Could not delete class' }, { status: 500 })
      }

      if (packageId) {
        const { error: pkgDelErr } = await svc
          .from('session_packages')
          .update({ is_active: false })
          .eq('id', packageId)
        if (pkgDelErr) {
          return NextResponse.json({ error: 'Could not deactivate class package' }, { status: 500 })
        }
      }

      return NextResponse.json({ data: { classGroupId, deleted: 'all' } })
    }

    // ------------------------------------------------------------------
    // scope: 'occurrence'  — cancel a single occurrence via override row
    // ------------------------------------------------------------------
    const occurrenceDate = dateParam!
    const targetDow = weekdayFromDate(occurrenceDate)

    const matchedSlot =
      slots.find((s) => s.one_time_date === occurrenceDate) ??
      slots.find((s) => s.one_time_date == null && s.day_of_week === targetDow)

    if (!matchedSlot) {
      return NextResponse.json(
        { error: 'No slot in this class group matches the occurrence date' },
        { status: 404 }
      )
    }

    const { error: ovErr } = await svc
      .from('class_occurrence_overrides')
      .upsert(
        {
          workspace_id: workspaceId,
          recurring_availability_id: matchedSlot.id,
          occurrence_date: occurrenceDate,
          canceled: true,
        },
        { onConflict: 'recurring_availability_id,occurrence_date' }
      )

    if (ovErr) {
      return NextResponse.json({ error: 'Could not cancel occurrence' }, { status: 500 })
    }

    return NextResponse.json({
      data: { classGroupId, scope: 'occurrence', occurrenceDate, canceled: true },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
