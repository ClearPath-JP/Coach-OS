import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns'

/**
 * GET /api/client/available-classes
 * Returns the next 4 weeks of bookable class slot instances for the client's coach.
 * Each instance is a specific date+time generated from a recurring_availability rule
 * where is_client_bookable=true AND it links to a session_package.
 *
 * Response shape:
 *   { data: ClassInstance[] }
 * where ClassInstance = {
 *   instanceKey: string,            // unique per slot+date, used as React key
 *   slotId: string,                 // recurring_availability.id
 *   packageId: string,              // session_packages.id
 *   instanceDate: 'YYYY-MM-DD',     // local date for this instance
 *   scheduledTimeISO: string,       // full ISO datetime for the slot start
 *   startTime: 'HH:mm',
 *   endTime: 'HH:mm',
 *   title: string,                  // package title
 *   durationMinutes: number,
 *   priceCents: number,
 *   capacity: number,
 *   bookedCount: number,            // how many paid bookings exist for this instance
 *   spotsRemaining: number,
 *   myBookingStatus: 'none' | 'booked' | 'paid'  // is this client already on it?
 * }
 */
const WEEKS_AHEAD = 4

export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`available-classes:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const service = createServiceClient()

    // Get bookable recurring_availability rules for the client's workspace
    // joined with session_package details
    const { data: slots, error: slotsErr } = await service
      .from('recurring_availability')
      .select(`
        id, day_of_week, start_time, end_time, label, session_product_id, coach_id,
        session_packages:session_product_id (
          id, title, price_cents, duration_minutes, capacity, is_active
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .eq('is_client_bookable', true)
      .not('session_product_id', 'is', null)

    if (slotsErr) {
      console.error('GET /api/client/available-classes slots', slotsErr)
      return NextResponse.json({ error: 'Could not load classes' }, { status: 500 })
    }

    // Generate instances for the next 4 weeks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Monday
    const rangeEnd = addWeeks(weekStart, WEEKS_AHEAD)

    type SlotRow = {
      id: string
      day_of_week: number
      start_time: string
      end_time: string
      label: string | null
      session_product_id: string | null
      coach_id: string
      session_packages: {
        id: string
        title: string
        price_cents: number
        duration_minutes: number
        capacity: number
        is_active: boolean
      } | { id: string; title: string; price_cents: number; duration_minutes: number; capacity: number; is_active: boolean }[] | null
    }
    type Instance = {
      instanceKey: string
      slotId: string
      packageId: string
      instanceDate: string
      scheduledTimeISO: string
      startTime: string
      endTime: string
      title: string
      durationMinutes: number
      priceCents: number
      capacity: number
      bookedCount: number
      spotsRemaining: number
      myBookingStatus: 'none' | 'booked' | 'paid'
    }

    const instances: Instance[] = []
    const slotIds: string[] = []
    const instanceKeysByDate = new Map<string, Instance[]>() // 'YYYY-MM-DD' → instances

    for (const raw of (slots ?? []) as SlotRow[]) {
      const pkg = Array.isArray(raw.session_packages) ? raw.session_packages[0] : raw.session_packages
      if (!pkg || !pkg.is_active) continue

      // Iterate each week, find the matching day_of_week
      for (let w = 0; w < WEEKS_AHEAD; w++) {
        const weekAnchor = addWeeks(weekStart, w)
        const instanceDate = addDays(weekAnchor, raw.day_of_week)
        if (instanceDate < today) continue
        if (instanceDate >= rangeEnd) continue

        const dateStr = format(instanceDate, 'yyyy-MM-dd')
        const startHHmm = raw.start_time.slice(0, 5)
        const endHHmm = raw.end_time.slice(0, 5)
        const [sh, sm] = startHHmm.split(':').map((x: string) => parseInt(x, 10))
        const scheduledTime = new Date(instanceDate)
        scheduledTime.setHours(sh ?? 0, sm ?? 0, 0, 0)

        // Skip past instances on today's date
        if (scheduledTime < new Date()) continue

        const inst: Instance = {
          instanceKey: `${raw.id}:${dateStr}`,
          slotId: raw.id,
          packageId: pkg.id,
          instanceDate: dateStr,
          scheduledTimeISO: scheduledTime.toISOString(),
          startTime: startHHmm,
          endTime: endHHmm,
          title: pkg.title,
          durationMinutes: pkg.duration_minutes ?? 60,
          priceCents: pkg.price_cents ?? 0,
          capacity: pkg.capacity ?? 1,
          bookedCount: 0,
          spotsRemaining: pkg.capacity ?? 1,
          myBookingStatus: 'none',
        }
        instances.push(inst)
        slotIds.push(raw.id)
        const list = instanceKeysByDate.get(dateStr) ?? []
        list.push(inst)
        instanceKeysByDate.set(dateStr, list)
      }
    }

    if (instances.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Fetch all existing bookings (paid OR pending) for these slot ids in this date range
    const fromIso = today.toISOString()
    const toIso = rangeEnd.toISOString()
    const { data: bookings } = await service
      .from('sessions')
      .select('id, recurring_availability_id, scheduled_time, paid_at, client_id, stripe_checkout_id')
      .in('recurring_availability_id', Array.from(new Set(slotIds)))
      .gte('scheduled_time', fromIso)
      .lt('scheduled_time', toIso)

    // Tally bookings per instance
    for (const b of (bookings ?? []) as Array<{
      id: string
      recurring_availability_id: string | null
      scheduled_time: string
      paid_at: string | null
      client_id: string | null
      stripe_checkout_id: string | null
    }>) {
      if (!b.recurring_availability_id) continue
      // Only paid bookings count toward capacity
      if (!b.paid_at) continue
      const d = parseISO(b.scheduled_time)
      const dateStr = format(d, 'yyyy-MM-dd')
      const key = `${b.recurring_availability_id}:${dateStr}`
      const inst = instances.find((i) => i.instanceKey === key)
      if (!inst) continue
      inst.bookedCount += 1
      inst.spotsRemaining = Math.max(0, inst.capacity - inst.bookedCount)
      if (b.client_id === clientId) {
        inst.myBookingStatus = 'paid'
      }
    }

    // Sort by date+time ascending
    instances.sort((a, b) => (a.scheduledTimeISO < b.scheduledTimeISO ? -1 : 1))

    return NextResponse.json({ data: instances })
  } catch (err) {
    console.error('GET /api/client/available-classes', err)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
