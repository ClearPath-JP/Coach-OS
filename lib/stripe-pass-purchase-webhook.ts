import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

/**
 * Credits a client's pass balance when they buy a class-credit pass via Stripe Checkout.
 *
 * Idempotent on stripe_checkout_id (a UNIQUE column), so a re-delivered webhook never
 * double-credits. ADDITIVE: each purchase is its own client_passes row — buying again
 * stacks credits and NEVER resets (unlike membership billing periods). Called from the
 * Stripe webhook on checkout.session.completed with metadata.type === 'pass_purchase'.
 */
export async function createPassFromCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: true; clientPassId: string } | { ok: false; reason: string }> {
  const meta = session.metadata ?? {}
  const passId = meta.pass_id as string | undefined
  const clientId = meta.client_id as string | undefined
  const workspaceId = meta.workspace_id as string | undefined
  const creditCount = meta.credit_count ? parseInt(meta.credit_count as string, 10) : NaN
  const expiresInDaysRaw = meta.expires_in_days as string | undefined
  const expiresInDays = expiresInDaysRaw ? parseInt(expiresInDaysRaw, 10) : null

  if (!passId || !clientId || !workspaceId || !Number.isFinite(creditCount) || creditCount <= 0) {
    return { ok: false, reason: 'Missing or invalid pass_purchase metadata' }
  }

  // Idempotency: one fulfillment per Checkout session.
  const { data: existing } = await supabase
    .from('client_passes')
    .select('id')
    .eq('stripe_checkout_id', session.id)
    .maybeSingle()
  if (existing?.id) {
    return { ok: true, clientPassId: existing.id as string }
  }

  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

  const { data: inserted, error } = await supabase
    .from('client_passes')
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      pass_id: passId,
      credits_total: creditCount,
      credits_remaining: creditCount,
      status: 'active',
      stripe_checkout_id: session.id,
      purchased_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error) {
    // Unique violation on stripe_checkout_id → a concurrent delivery already fulfilled it.
    if ((error as { code?: string }).code === '23505') {
      const { data: dup } = await supabase
        .from('client_passes')
        .select('id')
        .eq('stripe_checkout_id', session.id)
        .maybeSingle()
      if (dup?.id) return { ok: true, clientPassId: dup.id as string }
    }
    console.error('createPassFromCheckout insert', error)
    return { ok: false, reason: (error as { message?: string }).message ?? 'insert failed' }
  }
  if (!inserted) {
    return { ok: false, reason: 'insert returned no row' }
  }
  return { ok: true, clientPassId: inserted.id as string }
}
