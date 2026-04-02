import { format } from 'date-fns'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { invalidateCoachAnalyticsCaches, invalidatePaymentSummaryCaches } from '@/lib/api-cache'

/**
 * Completes a client invoice after Stripe Checkout (mode=payment) succeeds — webhook idempotency via invoice status.
 */
export async function markSessionInvoicePaidFromStripeCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: boolean; reason?: string }> {
  const invoiceId = session.metadata?.invoice_id
  const type = session.metadata?.type
  if (type !== 'client_invoice' || !invoiceId || session.mode !== 'payment') {
    return { ok: false, reason: 'not_invoice_checkout' }
  }

  const amountTotal = session.amount_total
  if (amountTotal == null) {
    return { ok: false, reason: 'no_amount' }
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? 'stripe_checkout'

  const { data: invoice, error: invErr } = await supabase
    .from('session_invoices')
    .select('id, workspace_id, client_id, coach_id, amount_cents, status, message_id, session_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice) {
    return { ok: false, reason: 'invoice_not_found' }
  }
  if (invoice.status === 'paid') {
    return { ok: true, reason: 'already_paid' }
  }
  if (invoice.amount_cents !== amountTotal) {
    return { ok: false, reason: 'amount_mismatch' }
  }

  const paidAt = new Date().toISOString()

  const { error: upInvErr } = await supabase
    .from('session_invoices')
    .update({
      status: 'paid',
      paid_at: paidAt,
      payment_method: 'stripe',
      payment_reference: paymentIntentId,
      updated_at: paidAt,
    })
    .eq('id', invoiceId)
    .eq('workspace_id', invoice.workspace_id)

  if (upInvErr) {
    return { ok: false, reason: 'update_failed' }
  }

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('invoice_id', invoiceId)
    .maybeSingle()

  if (!existingPayment) {
    await supabase.from('payments').insert({
      workspace_id: invoice.workspace_id,
      coach_id: invoice.coach_id,
      client_id: invoice.client_id,
      invoice_id: invoiceId,
      session_id: invoice.session_id,
      amount_cents: invoice.amount_cents,
      currency: 'usd',
      payment_method: 'stripe',
      payment_reference: paymentIntentId,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
    })
  }

  if (invoice.message_id) {
    const { data: msg } = await supabase
      .from('messages')
      .select('content')
      .eq('id', invoice.message_id)
      .maybeSingle()
    if (msg?.content) {
      try {
        const payload = JSON.parse(msg.content as string) as Record<string, unknown>
        const updatedContent = JSON.stringify({
          ...payload,
          status: 'paid',
          paidAt,
          paymentMethod: 'stripe',
        })
        await supabase.from('messages').update({ content: updatedContent }).eq('id', invoice.message_id)
      } catch {
        /* non-fatal */
      }
    }
  }

  void invalidatePaymentSummaryCaches(invoice.workspace_id as string)
  void invalidateCoachAnalyticsCaches(invoice.workspace_id as string)

  return { ok: true }
}
