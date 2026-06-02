import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createClassSchema } from '@/lib/validations'

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
  is_active: boolean
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

/** Weekday Mon=0 … Sun=6 from a YYYY-MM-DD string, matching recurring_availability.day_of_week. */
function weekdayFromDate(dateStr: string): number {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7
}

// ---------------------------------------------------------------------------
// GET /api/coach/classes — list classes grouped by class_group_id
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`classes-get:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again in a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    // Fetch all slots that belong to a class group for this coach/workspace.
    // Cast via unknown because the migration columns aren't yet in generated types.
    const { data: rawSlots, error: slotsError } = await supabase
      .from('recurring_availability')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('coach_id', user.id)
      .not('class_group_id', 'is', null)
      .order('start_time')

    if (slotsError) {
      return NextResponse.json({ error: 'Could not load classes' }, { status: 500 })
    }

    const slots = (rawSlots ?? []) as unknown as ClassSlot[]

    if (slots.length === 0) {
      return NextResponse.json({ data: { classes: [] } })
    }

    // Collect unique package ids
    const packageIds = [...new Set(slots.map((s) => s.session_product_id).filter(Boolean))] as string[]

    const { data: packages, error: pkgError } = await supabase
      .from('session_packages')
      .select('id, title, description, price_cents, currency, duration_minutes, session_type, capacity, is_virtual, is_active')
      .in('id', packageIds)

    if (pkgError) {
      return NextResponse.json({ error: 'Could not load class packages' }, { status: 500 })
    }

    type PkgRow = NonNullable<typeof packages>[number]
    const pkgMap = new Map<string, PkgRow>((packages ?? []).map((p) => [p.id, p]))

    // Group slots by class_group_id
    const groups = new Map<string, ClassSlot[]>()
    for (const slot of slots) {
      const gid = slot.class_group_id as string
      if (!groups.has(gid)) groups.set(gid, [])
      groups.get(gid)!.push(slot)
    }

    const classes = Array.from(groups.entries()).map(([groupId, groupSlots]) => {
      const first = groupSlots[0]!
      const pkg = first.session_product_id ? pkgMap.get(first.session_product_id) : undefined
      const isOneTime = first.one_time_date != null

      return {
        classGroupId: groupId,
        // Package fields
        name: pkg?.title ?? first.name ?? null,
        description: pkg?.description ?? null,
        type: pkg?.session_type ?? null,
        priceCents: pkg?.price_cents ?? 0,
        currency: pkg?.currency ?? 'usd',
        durationMinutes: pkg?.duration_minutes ?? null,
        capacity: pkg?.capacity ?? null,
        isVirtual: pkg?.is_virtual ?? false,
        packageId: pkg?.id ?? null,
        // Slot fields (shared across the group)
        location: first.location,
        color: first.color,
        status: first.status,
        memberAccess: first.member_access,
        startTime: first.start_time,
        endTime: first.end_time,
        isActive: first.is_active,
        // Schedule
        recurring: !isOneTime,
        days: isOneTime ? null : groupSlots.map((s) => s.day_of_week).sort((a, b) => a - b),
        oneTimeDate: isOneTime ? first.one_time_date : null,
        // Raw slots for UI reference
        slots: groupSlots.map((s) => ({ id: s.id, dayOfWeek: s.day_of_week, oneTimeDate: s.one_time_date })),
      }
    })

    return NextResponse.json({ data: { classes } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/coach/classes — create a class
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`classes-post:${ip}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again in a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = createClassSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const {
      name,
      type,
      description,
      location,
      capacity,
      priceCents,
      currency,
      durationMinutes,
      startTime,
      color,
      status,
      memberAccess,
      isVirtual,
      recurring,
      days,
      oneTimeDate,
    } = parsed.data

    const endTime = addMinutesToTime(startTime, durationMinutes)
    const classGroupId = crypto.randomUUID()

    // Use service client for writes (bypasses RLS)
    const svc = createServiceClient()

    // 1. Insert session_packages row
    const { data: pkg, error: pkgErr } = await svc
      .from('session_packages')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title: name,
        description: description ?? null,
        price_cents: priceCents,
        currency: currency ?? 'usd',
        duration_minutes: durationMinutes,
        session_type: type,
        is_virtual: isVirtual ?? false,
        is_active: true,
        capacity,
      })
      .select('id, title, description, price_cents, currency, duration_minutes, session_type, capacity, is_virtual, is_active')
      .single()

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Could not create class package' }, { status: 500 })
    }

    // 2. Build recurring_availability rows
    const slotBase = {
      workspace_id: workspaceId,
      coach_id: user.id,
      name,
      location: location ?? null,
      color: color ?? null,
      status,
      member_access: memberAccess,
      class_group_id: classGroupId,
      start_time: startTime,
      end_time: endTime,
      session_product_id: pkg.id,
      is_client_bookable: true,
      is_active: true,
    }

    let slotRows: object[]

    if (recurring) {
      // One row per weekday
      slotRows = (days ?? []).map((d) => ({
        ...slotBase,
        day_of_week: d,
        one_time_date: null,
      }))
    } else {
      // Single one-time slot; derive weekday from the date
      const dow = weekdayFromDate(oneTimeDate!)
      slotRows = [
        {
          ...slotBase,
          day_of_week: dow,
          one_time_date: oneTimeDate,
        },
      ]
    }

    const { data: rawInserted, error: slotErr } = await svc
      .from('recurring_availability')
      .insert(slotRows)
      .select('*')

    if (slotErr || !rawInserted) {
      console.error('POST /api/coach/classes — slot insert', slotErr)
      // Best-effort cleanup of the package we just created
      await svc.from('session_packages').delete().eq('id', pkg.id)
      return NextResponse.json({ error: 'Could not create class slots' }, { status: 500 })
    }

    const insertedSlots = rawInserted as unknown as ClassSlot[]
    const isOneTime = !recurring

    const response = {
      classGroupId,
      packageId: pkg.id,
      name: pkg.title,
      description: pkg.description,
      type: pkg.session_type,
      priceCents: pkg.price_cents,
      currency: pkg.currency,
      durationMinutes: pkg.duration_minutes,
      capacity: pkg.capacity,
      isVirtual: pkg.is_virtual,
      location: location ?? null,
      color: color ?? null,
      status,
      memberAccess,
      startTime,
      endTime,
      recurring: !isOneTime,
      days: isOneTime ? null : (days ?? []).slice().sort((a, b) => a - b),
      oneTimeDate: isOneTime ? oneTimeDate : null,
      slots: insertedSlots.map((s) => ({ id: s.id, dayOfWeek: s.day_of_week, oneTimeDate: s.one_time_date })),
    }

    return NextResponse.json({ data: response }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
