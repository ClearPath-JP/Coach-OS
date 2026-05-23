import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

/**
 * Creates a `sessions` row when a client successfully pays for a class via Stripe Checkout.
 * Idempotent: if a session with the same stripe_checkout_id already exists, no-op.
 * Called from the Stripe webhook handler on `checkout.session.completed` with
 * `metadata.type === 'class_booking'`.
 */
export async function createSessionFromClassBookingCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: true; sessionId: string } | { ok: false; reason: string }> {
  const meta = session.metadata ?? {}
  const slotId = meta.slot_id as string | undefined
  const clientId = meta.client_id as string | undefined
  const workspaceId = meta.workspace_id as string | undefined
  const coachId = meta.coach_id as string | undefined
  const scheduledTimeIso = meta.scheduled_time_iso as string | undefined
  const durationMinutesStr = meta.duration_minutes as string | undefined
  const sessionProductId = meta.session_product_id as string | undefined

  if (!slotId || !clientId || !workspaceId || !coachId || !scheduledTimeIso) {
    return { ok: false, reason: 'Missing class_booking metadata' }
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

  const durationMinutes = durationMinutesStr ? parseInt(durationMinutesStr, 10) : 60
  const scheduledTime = new Date(scheduledTimeIso)
  const endTime = new Date(scheduledTime.getTime() + durationMinutes * 60_000)

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
    // If conflict due to the unique constraint (client already booked same instance), treat as OK
    if (error.code === '23505') {
      return { ok: false, reason: 'Already booked' }
    }
    console.error('createSessionFromClassBookingCheckout insert', error)
    return { ok: false, reason: error.message }
  }
  return { ok: true, sessionId: inserted.id as string }
}
