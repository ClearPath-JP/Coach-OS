import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { logServerError } from '@/lib/log-server-error'

/**
 * Creates a `sessions` row when a client successfully pays for a class via Stripe Checkout.
 * Idempotent: if a session with the same stripe_checkout_id already exists, no-op.
 * Called from the Stripe webhook handler on `checkout.session.completed` with
 * `metadata.type === 'class_booking'`.
 *
 * Failure contract for the webhook caller:
 *  - `permanent: true` → retrying can never change the outcome (already logged to the
 *    admin Errors feed here) — the webhook should ack 200.
 *  - no `permanent` → transient (e.g. DB error); the webhook should 5xx so Stripe retries.
 */
export async function createSessionFromClassBookingCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: true; sessionId: string } | { ok: false; reason: string; permanent?: boolean }> {
  const meta = session.metadata ?? {}
  const slotId = meta.slot_id as string | undefined
  const clientId = meta.client_id as string | undefined
  const workspaceId = meta.workspace_id as string | undefined
  const coachId = meta.coach_id as string | undefined
  const scheduledTimeIso = meta.scheduled_time_iso as string | undefined
  const durationMinutesStr = meta.duration_minutes as string | undefined
  const sessionProductId = meta.session_product_id as string | undefined
  const instanceDate = (meta.instance_date as string | undefined) ?? scheduledTimeIso ?? 'unknown'

  if (!slotId || !clientId || !workspaceId || !coachId || !scheduledTimeIso) {
    // Can never heal on retry — flag loudly: the client may be PAID but UNBOOKED.
    await logServerError(
      'stripe-class-booking-webhook',
      new Error('class_booking checkout missing metadata — client may be paid but unbooked'),
      { checkoutSessionId: session.id, metadata: meta }
    )
    return { ok: false, reason: 'Missing class_booking metadata', permanent: true }
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('stripe_checkout_id', session.id)
    .maybeSingle()
  if (existing?.id) {
    return { ok: true, sessionId: existing.id as string }
  }

  const parsedDuration = durationMinutesStr ? parseInt(durationMinutesStr, 10) : 60
  const durationMinutes = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60
  const scheduledTime = new Date(scheduledTimeIso)
  if (!Number.isFinite(scheduledTime.getTime())) {
    // Invalid date in metadata can never heal on retry — flag loudly (paid but unbooked).
    await logServerError(
      'stripe-class-booking-webhook',
      new Error('class_booking checkout has invalid scheduled_time_iso — client may be paid but unbooked'),
      { checkoutSessionId: session.id, scheduledTimeIso, slotId, clientId, workspaceId }
    )
    return { ok: false, reason: 'Invalid scheduled_time_iso metadata', permanent: true }
  }
  const endTime = new Date(scheduledTime.getTime() + durationMinutes * 60_000)

  // Oversell detection (conservative — never blocks the paid booking). Capacity is
  // only checked at checkout creation, so two buyers of the last seat can both pay.
  // We honor every payment and flag the oversell for human resolution.
  let willOversell = false
  let capacity: number | null = null
  try {
    if (sessionProductId) {
      const { data: pkg } = await supabase
        .from('session_packages')
        .select('capacity')
        .eq('id', sessionProductId)
        .maybeSingle()
      capacity = (pkg?.capacity as number | null) ?? null
      if (capacity != null && capacity > 0) {
        // Same ±1 minute instance window the booking route uses.
        const windowStart = new Date(scheduledTime)
        windowStart.setMinutes(windowStart.getMinutes() - 1)
        const windowEnd = new Date(scheduledTime)
        windowEnd.setMinutes(windowEnd.getMinutes() + 1)
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('recurring_availability_id', slotId)
          .not('paid_at', 'is', null)
          .gte('scheduled_time', windowStart.toISOString())
          .lt('scheduled_time', windowEnd.toISOString())
        if ((count ?? 0) >= capacity) willOversell = true
      }
    }
  } catch {
    // Detection is best-effort — never let it interfere with fulfillment.
  }

  const { data: inserted, error } = await supabase
    .from('sessions')
    .insert({
      workspace_id: workspaceId,
      coach_id: coachId,
      client_id: clientId,
      scheduled_time: scheduledTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      status: 'confirmed',
      session_product_id: sessionProductId || null,
      recurring_availability_id: slotId,
      stripe_checkout_id: session.id,
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    // Conflict on the unique constraint: client already booked this instance another
    // way (e.g. paid twice from two tabs). The money was still captured — flag for a
    // human; retrying cannot change this.
    if (error.code === '23505') {
      await logServerError(
        'stripe-class-booking-webhook',
        new Error('duplicate paid booking, manual refund may be needed'),
        { checkoutSessionId: session.id, slotId, clientId, workspaceId, instanceDate }
      )
      return { ok: false, reason: 'Already booked', permanent: true }
    }
    console.error('createSessionFromClassBookingCheckout insert', error)
    return { ok: false, reason: error.message }
  }

  if (!inserted?.id) {
    // Should not happen when .single() reports no error — treat as transient so Stripe retries.
    return { ok: false, reason: 'insert returned no row' }
  }

  if (willOversell) {
    await logServerError(
      'stripe-class-booking-webhook',
      new Error(`OVERSOLD class ${slotId} occurrence ${instanceDate}`),
      {
        checkoutSessionId: session.id,
        slotId,
        clientId,
        workspaceId,
        capacity,
        instanceDate,
        sessionId: inserted.id,
      }
    )
  }

  return { ok: true, sessionId: inserted.id as string }
}
