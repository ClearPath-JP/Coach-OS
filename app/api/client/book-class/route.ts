import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireClient } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const bookSchema = z.object({
  slotId: z.string().uuid(),
  instanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'instanceDate must be YYYY-MM-DD'),
})

/**
 * POST /api/client/book-class
 * Body: { slotId, instanceDate }
 *
 * Creates a Stripe Checkout session for this client to pay for the class.
 * On payment success, the webhook (extension) inserts a `sessions` row.
 * Validates: slot is bookable, instance is in future, capacity not full,
 * client hasn't already paid for this instance.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`book-class:${user.id}`, {
      windowMs: 60_000,
      max: 10,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many booking attempts — please wait a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Booking unavailable — coach has not enabled payments' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const parsed = bookSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { slotId, instanceDate } = parsed.data
    const service = createServiceClient()

    // 1. Load the slot + package
    const { data: slot, error: slotErr } = await service
      .from('recurring_availability')
      .select(`
        id, workspace_id, coach_id, day_of_week, start_time, end_time,
        is_client_bookable, is_active, session_product_id,
        session_packages:session_product_id (
          id, title, price_cents, currency, duration_minutes, capacity, is_active
        )
      `)
      .eq('id', slotId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    if (!slot.is_active || !slot.is_client_bookable) {
      return NextResponse.json({ error: 'This class is not bookable' }, { status: 400 })
    }
    type Pkg = { id: string; title: string; price_cents: number; currency: string | null; duration_minutes: number; capacity: number; is_active: boolean }
    const pkg = (Array.isArray(slot.session_packages) ? slot.session_packages[0] : slot.session_packages) as Pkg | null
    if (!pkg || !pkg.is_active) {
      return NextResponse.json({ error: 'Class type not available' }, { status: 400 })
    }

    // 2. Validate instanceDate matches day_of_week and is in the future
    const date = new Date(`${instanceDate}T00:00:00`)
    const jsDay = date.getDay() // Sun=0..Sat=6
    const ruleDay = jsDay === 0 ? 6 : jsDay - 1 // Mon=0..Sun=6
    if (ruleDay !== slot.day_of_week) {
      return NextResponse.json({ error: 'Date does not match this class day' }, { status: 400 })
    }
    const [sh, sm] = slot.start_time.slice(0, 5).split(':').map((x: string) => parseInt(x, 10))
    const scheduledTime = new Date(date)
    scheduledTime.setHours(sh ?? 0, sm ?? 0, 0, 0)
    if (scheduledTime.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This class has already started or finished' }, { status: 400 })
    }

    // 3. Check capacity + duplicate bookings for THIS instance
    const startOfInstance = new Date(scheduledTime); startOfInstance.setMinutes(startOfInstance.getMinutes() - 1)
    const endOfInstance = new Date(scheduledTime); endOfInstance.setMinutes(endOfInstance.getMinutes() + 1)
    const { data: existingBookings } = await service
      .from('sessions')
      .select('id, client_id, paid_at, stripe_checkout_id')
      .eq('recurring_availability_id', slotId)
      .gte('scheduled_time', startOfInstance.toISOString())
      .lt('scheduled_time', endOfInstance.toISOString())

    const paid = (existingBookings ?? []).filter((b) => b.paid_at != null)
    if (paid.length >= pkg.capacity) {
      return NextResponse.json({ error: 'This class is full' }, { status: 409 })
    }
    const mineAlreadyPaid = paid.find((b) => b.client_id === clientId)
    if (mineAlreadyPaid) {
      return NextResponse.json({ error: 'You are already booked for this class' }, { status: 409 })
    }

    // 4. Coach must have Stripe Connect set up
    const { data: workspace } = await service
      .from('workspaces')
      .select('stripe_connect_account_id, name')
      .eq('id', workspaceId)
      .maybeSingle()
    const connectId = workspace?.stripe_connect_account_id as string | null
    if (!connectId) {
      return NextResponse.json(
        { error: 'Your coach has not finished setting up payments yet.' },
        { status: 503 }
      )
    }

    // 5. Get client display info for receipt
    const { data: client } = await service
      .from('clients')
      .select('email, first_name, last_name')
      .eq('id', clientId)
      .maybeSingle()

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin') ?? 'http://localhost:3000'

    // 6. Create Stripe Checkout — destination charge to coach's connected account
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: pkg.currency ?? 'usd',
              unit_amount: pkg.price_cents,
              product_data: {
                name: pkg.title,
                description: `${pkg.duration_minutes} min class on ${instanceDate} at ${slot.start_time.slice(0, 5)}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: client?.email ?? user.email ?? undefined,
        success_url: `${baseUrl}/client/sessions?booked=1`,
        cancel_url: `${baseUrl}/client/sessions?booking_cancelled=1`,
        payment_intent_data: {
          transfer_data: { destination: connectId },
          // 0% platform fee for now per user decision 2026-05-23
        },
        metadata: {
          type: 'class_booking',
          slot_id: slotId,
          instance_date: instanceDate,
          scheduled_time_iso: scheduledTime.toISOString(),
          client_id: clientId,
          workspace_id: workspaceId,
          coach_id: slot.coach_id,
          session_product_id: pkg.id,
          duration_minutes: String(pkg.duration_minutes),
        },
      }
    )

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create checkout' }, { status: 502 })
    }
    return NextResponse.json({ data: { url: session.url } })
  } catch (err) {
    console.error('POST /api/client/book-class', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
