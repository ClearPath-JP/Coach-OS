import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, STRIPE_WEBHOOK_SECRET, STRIPE_PRICES } from '@/lib/stripe'
import { markSessionInvoicePaidFromStripeCheckout } from '@/lib/stripe-client-invoice-checkout'
import { createSessionFromClassBookingCheckout } from '@/lib/stripe-class-booking-webhook'
import { createPassFromCheckout } from '@/lib/stripe-pass-purchase-webhook'
import { activateNewCoach, type WorkspacePlan } from '@/lib/new-coach-activation'
import { logServerError } from '@/lib/log-server-error'
import type Stripe from 'stripe'

/**
 * POST /api/webhooks/stripe — Stripe webhook (subscriptions + existing checkout logic).
 * No Supabase session; verify Stripe signature. Use raw body for verification.
 *
 * Ack semantics:
 *  - Non-money events: always return 200 (errors are logged internally) — unchanged.
 *  - MONEY-fulfillment branches (pass purchase, class booking, membership lifecycle,
 *    new-coach activation): a TRANSIENT failure logs to the admin Errors feed, deletes
 *    the just-inserted event-dedupe row, and returns 503 so Stripe RETRIES — a client
 *    must never stay paid-but-unfulfilled silently. PERMANENT failures (e.g. duplicate
 *    paid booking, malformed metadata) are logged and acked with 200 because retrying
 *    can never change the outcome.
 *  - Duplicate deliveries (dedupe row already present / 23505 on insert) fast-ack 200.
 *
 * Membership isolation: for subscription/invoice events, look up client_memberships
 * by stripe_subscription_id FIRST. If a row exists → handle as membership, break/return
 * without touching workspace logic. If not found → fall through to workspace handling unchanged.
 */

type MembershipStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'

/** Map a Stripe subscription status to client_memberships.status. */
function stripeStatusToMembership(stripeStatus: Stripe.Subscription.Status): MembershipStatus {
  switch (stripeStatus) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due':
    case 'unpaid': return 'past_due'
    case 'canceled':
    case 'incomplete_expired': return 'canceled'
    case 'incomplete':
    default: return 'incomplete'
  }
}

function priceIdToPlan(priceId: string): 'founding' | 'starter' | 'pro' | 'scale' | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICES)) {
    if (id === priceId) return plan as 'founding' | 'starter' | 'pro' | 'scale'
  }
  return null
}

/** Cancel a Stripe subscription; treat already-canceled as success. */
async function cancelStripeSubscriptionSafe(
  subId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!stripe) return { ok: false, reason: 'stripe not configured' }
  try {
    await stripe.subscriptions.cancel(subId)
    return { ok: true }
  } catch (err) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      if (sub.status === 'canceled') return { ok: true }
    } catch {
      // fall through to failure below
    }
    return { ok: false, reason: err instanceof Error ? err.message : 'cancel failed' }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature || !STRIPE_WEBHOOK_SECRET || !stripe) {
    return NextResponse.json({ error: 'Missing signature or config' }, { status: 400 })
  }
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const { data: existing } = await supabase
      .from('stripe_webhook_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ received: true })
    }
    const { error: dedupeInsertErr } = await supabase
      .from('stripe_webhook_events')
      .insert({ event_id: event.id })
    if (dedupeInsertErr?.code === '23505') {
      // Concurrent duplicate delivery — the first delivery is processing this event.
      return NextResponse.json({ received: true })
    }
  } catch {
    return NextResponse.json({ received: true })
  }

  // True while processing a money-fulfillment branch: failures there must make
  // Stripe retry (release dedupe row + 5xx) instead of being swallowed with a 200.
  let moneyEvent = false
  const failMoneyEvent = async (
    context: string,
    err: unknown,
    meta?: Record<string, unknown>
  ): Promise<NextResponse> => {
    await logServerError(context, err, { eventType: event.type, eventId: event.id, ...(meta ?? {}) })
    const { error: delErr } = await supabase
      .from('stripe_webhook_events')
      .delete()
      .eq('event_id', event.id)
    if (delErr) {
      console.error('[webhook] could not release dedupe row for retry', event.id, delErr)
    }
    return NextResponse.json({ error: 'Fulfillment failed — Stripe will retry' }, { status: 503 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment' && session.metadata?.type === 'client_invoice') {
          await markSessionInvoicePaidFromStripeCheckout(supabase, session)
          return NextResponse.json({ received: true })
        }
        if (session.mode === 'payment' && session.metadata?.type === 'class_booking') {
          moneyEvent = true
          const result = await createSessionFromClassBookingCheckout(supabase, session)
          if (!result.ok && !result.permanent) {
            // Transient (e.g. DB error): client paid but has no booking — retry.
            return await failMoneyEvent(
              'stripe-webhook class_booking fulfillment',
              new Error(result.reason),
              { checkoutSessionId: session.id }
            )
          }
          // ok, or permanent (already logged inside the lib) → ack.
          return NextResponse.json({ received: true })
        }
        if (session.mode === 'payment' && session.metadata?.type === 'pass_purchase') {
          moneyEvent = true
          const result = await createPassFromCheckout(supabase, session)
          if (!result.ok) {
            if (!result.permanent) {
              // Transient: client paid but has no credits — retry.
              return await failMoneyEvent(
                'stripe-webhook pass_purchase fulfillment',
                new Error(result.reason),
                { checkoutSessionId: session.id }
              )
            }
            await logServerError(
              'stripe-webhook pass_purchase fulfillment',
              new Error(result.reason),
              { eventId: event.id, checkoutSessionId: session.id }
            )
          }
          return NextResponse.json({ received: true })
        }
        // --- Client membership checkout ---
        if (session.mode === 'subscription' && session.metadata?.type === 'client_membership') {
          moneyEvent = true
          const clientId = session.metadata?.client_id as string | undefined
          const workspaceId = session.metadata?.workspace_id as string | undefined
          const planId = session.metadata?.plan_id as string | undefined
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null
          if (!clientId || !workspaceId || !planId || !subId) {
            // Permanent — retrying cannot conjure missing metadata. Log loudly + ack.
            await logServerError(
              'stripe-webhook client_membership fulfillment',
              new Error('client_membership checkout missing metadata — client may be paying with no membership recorded'),
              { eventId: event.id, checkoutSessionId: session.id, metadata: session.metadata ?? {} }
            )
            return NextResponse.json({ received: true })
          }

          const memberSub = await stripe.subscriptions.retrieve(subId)
          const memberStatus = stripeStatusToMembership(memberSub.status)
          const periodStart = memberSub.current_period_start
            ? new Date(memberSub.current_period_start * 1000).toISOString()
            : null
          const periodEnd = memberSub.current_period_end
            ? new Date(memberSub.current_period_end * 1000).toISOString()
            : null

          // Manual upsert by stripe_subscription_id — there's no unique index on it,
          // so ON CONFLICT can't be used. Select-then-update-or-insert instead.
          const { data: existingMember, error: existingErr } = await supabase
            .from('client_memberships')
            .select('id')
            .eq('stripe_subscription_id', subId)
            .maybeSingle()
          if (existingErr) {
            return await failMoneyEvent(
              'stripe-webhook client_membership fulfillment',
              new Error(`membership lookup failed: ${existingErr.message}`),
              { checkoutSessionId: session.id, subId }
            )
          }

          const membershipRow = {
            client_id: clientId,
            workspace_id: workspaceId,
            plan_id: planId,
            stripe_subscription_id: subId,
            status: memberStatus,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          }

          if (existingMember) {
            const { error: updErr } = await supabase
              .from('client_memberships')
              .update(membershipRow)
              .eq('id', existingMember.id)
            if (updErr) {
              return await failMoneyEvent(
                'stripe-webhook client_membership fulfillment',
                new Error(`membership update failed: ${updErr.message}`),
                { checkoutSessionId: session.id, subId }
              )
            }
            return NextResponse.json({ received: true })
          }

          // Two open checkout tabs can create TWO live Stripe subscriptions for the same
          // client. If a different live membership already exists, cancel the NEWER Stripe
          // subscription (the one from this checkout) instead of double-billing the client.
          const { data: liveOther, error: liveErr } = await supabase
            .from('client_memberships')
            .select('id, stripe_subscription_id')
            .eq('client_id', clientId)
            .eq('workspace_id', workspaceId)
            .in('status', ['active', 'trialing', 'past_due'])
            .neq('stripe_subscription_id', subId)
            .limit(1)
            .maybeSingle()
          if (liveErr) {
            return await failMoneyEvent(
              'stripe-webhook client_membership fulfillment',
              new Error(`live membership lookup failed: ${liveErr.message}`),
              { checkoutSessionId: session.id, subId }
            )
          }
          if (liveOther) {
            const cancelled = await cancelStripeSubscriptionSafe(subId)
            if (!cancelled.ok) {
              // Both subscriptions are still live — must retry until the cancel sticks.
              return await failMoneyEvent(
                'stripe-webhook client_membership duplicate',
                new Error(`duplicate membership detected but cancel failed: ${cancelled.reason}`),
                { checkoutSessionId: session.id, cancelledSub: subId, keptSub: liveOther.stripe_subscription_id }
              )
            }
            await logServerError(
              'stripe-webhook client_membership duplicate',
              new Error('duplicate membership subscription auto-cancelled — first invoice may need manual refund'),
              {
                eventId: event.id,
                checkoutSessionId: session.id,
                clientId,
                workspaceId,
                planId,
                cancelledSub: subId,
                keptSub: liveOther.stripe_subscription_id,
              }
            )
            return NextResponse.json({ received: true })
          }

          const { error: insErr } = await supabase
            .from('client_memberships')
            .insert({ ...membershipRow, classes_used_this_period: 0 })
          if (insErr) {
            if (insErr.code === '23505') {
              // uq_client_live_membership: a live/incomplete membership row appeared
              // concurrently. If it records THIS subscription (duplicate delivery race)
              // we're done; otherwise treat as a duplicate subscription → cancel the
              // newer one (this one) and flag for a human.
              const { data: blocker } = await supabase
                .from('client_memberships')
                .select('id, stripe_subscription_id')
                .eq('client_id', clientId)
                .eq('workspace_id', workspaceId)
                .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
                .limit(1)
                .maybeSingle()
              if (blocker?.stripe_subscription_id === subId) {
                return NextResponse.json({ received: true })
              }
              const cancelled = await cancelStripeSubscriptionSafe(subId)
              if (!cancelled.ok) {
                return await failMoneyEvent(
                  'stripe-webhook client_membership duplicate',
                  new Error(`duplicate membership detected but cancel failed: ${cancelled.reason}`),
                  { checkoutSessionId: session.id, cancelledSub: subId, keptSub: blocker?.stripe_subscription_id ?? null }
                )
              }
              await logServerError(
                'stripe-webhook client_membership duplicate',
                new Error('duplicate membership subscription auto-cancelled — first invoice may need manual refund'),
                {
                  eventId: event.id,
                  checkoutSessionId: session.id,
                  clientId,
                  workspaceId,
                  planId,
                  cancelledSub: subId,
                  keptSub: blocker?.stripe_subscription_id ?? null,
                }
              )
              return NextResponse.json({ received: true })
            }
            return await failMoneyEvent(
              'stripe-webhook client_membership fulfillment',
              new Error(`membership insert failed: ${insErr.message}`),
              { checkoutSessionId: session.id, subId }
            )
          }
          return NextResponse.json({ received: true })
        }
        if (session.mode !== 'subscription' || !session.subscription) {
          return NextResponse.json({ received: true })
        }
        // session.subscription is a string id on webhook payloads, but normalize
        // defensively in case it arrives expanded.
        const checkoutSubId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        const workspaceId = session.metadata?.workspace_id as string | undefined
        const newCoachUserId = session.metadata?.user_id as string | undefined

        if (!workspaceId && !newCoachUserId) return NextResponse.json({ received: true })

        // --- New coach checkout (no workspace yet) ---
        // /api/billing/new-coach-activate handles the happy path on redirect, but it only
        // runs if the buyer's browser comes back with a live session. This branch is the
        // backstop: close the tab on Stripe's success page and the webhook still activates
        // the account. activateNewCoach() is idempotent and serialized, so both can run.
        if (!workspaceId && newCoachUserId) {
          moneyEvent = true
          if (session.payment_status !== 'paid' && session.status !== 'complete') {
            return NextResponse.json({ received: true })
          }
          const newCoachSub = await stripe.subscriptions.retrieve(checkoutSubId)
          const newCoachPriceId = newCoachSub.items.data[0]?.price?.id
          const metaPlan = session.metadata?.plan as string | undefined
          const newCoachPlan: WorkspacePlan =
            metaPlan && ['founding', 'starter', 'pro', 'scale'].includes(metaPlan)
              ? (metaPlan as WorkspacePlan)
              : newCoachPriceId
                ? priceIdToPlan(newCoachPriceId) ?? 'starter'
                : 'starter'

          const activation = await activateNewCoach(supabase, {
            userId: newCoachUserId,
            plan: newCoachPlan,
            stripeCustomerId:
              typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
            stripeSubscriptionId: newCoachSub.id,
            subscriptionStatus:
              newCoachSub.status === 'trialing'
                ? 'trialing'
                : newCoachSub.status === 'active'
                  ? 'active'
                  : 'past_due',
            currentPeriodEnd: newCoachSub.current_period_end
              ? new Date(newCoachSub.current_period_end * 1000).toISOString()
              : null,
            trialEndsAt: newCoachSub.trial_end
              ? new Date(newCoachSub.trial_end * 1000).toISOString()
              : null,
          })

          if (!activation.ok) {
            if (activation.inProgress) {
              // The redirect path holds the activation claim right now. Release our
              // dedupe row + 503 (no error log — this is expected contention): Stripe
              // redelivers and the retry fast-paths to "already active", or finishes
              // the job if the redirect attempt crashed.
              console.warn('[webhook] new-coach activation in progress; deferring to Stripe retry')
              const { error: delErr } = await supabase
                .from('stripe_webhook_events')
                .delete()
                .eq('event_id', event.id)
              if (delErr) {
                console.error('[webhook] could not release dedupe row for retry', event.id, delErr)
              }
              return NextResponse.json(
                { error: 'Activation in progress — Stripe will retry' },
                { status: 503 }
              )
            }
            return await failMoneyEvent(
              'stripe-webhook new-coach activation',
              new Error(activation.reason),
              { userId: newCoachUserId, checkoutSessionId: session.id }
            )
          }
          return NextResponse.json({ received: true })
        }
        if (!workspaceId) return NextResponse.json({ received: true })

        const sub = await stripe.subscriptions.retrieve(checkoutSubId)
        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? priceIdToPlan(priceId) ?? 'starter' : 'starter'
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('workspace_id', workspaceId)
          .maybeSingle()

        const row = {
          workspace_id: workspaceId,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan,
          status: (sub.status === 'trialing' ? 'trialing' : sub.status === 'active' ? 'active' : 'past_due') as 'trialing' | 'active' | 'past_due',
          current_period_end: periodEnd,
          trial_ends_at: trialEnd,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        }
        if (existingSub) {
          await supabase.from('subscriptions').update(row).eq('workspace_id', workspaceId)
        } else {
          await supabase.from('subscriptions').insert(row)
        }
        if (customerId) {
          await supabase.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', workspaceId)
        }
        break
      }
      // invoice.paid — new billing period: reset client membership allotment.
      // invoice.payment_succeeded is a Stripe alias; handle identically via fallthrough.
      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceSubId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as Stripe.Subscription | null)?.id ?? null
        if (invoiceSubId) {
          const { data: memberRow, error: lookupErr } = await supabase
            .from('client_memberships')
            .select('id')
            .eq('stripe_subscription_id', invoiceSubId)
            .maybeSingle()
          if (lookupErr) {
            // Can't tell membership from workspace — retry the whole (idempotent) event.
            return await failMoneyEvent(
              'stripe-webhook membership period reset',
              new Error(`membership lookup failed: ${lookupErr.message}`),
              { subscriptionId: invoiceSubId }
            )
          }
          if (memberRow) {
            moneyEvent = true
            // Retrieve subscription to get fresh period boundaries.
            const memberSub = await stripe.subscriptions.retrieve(invoiceSubId)
            const periodStart = memberSub.current_period_start
              ? new Date(memberSub.current_period_start * 1000).toISOString()
              : null
            const periodEnd = memberSub.current_period_end
              ? new Date(memberSub.current_period_end * 1000).toISOString()
              : null
            const { error: resetErr } = await supabase
              .from('client_memberships')
              .update({
                classes_used_this_period: 0,
                current_period_start: periodStart,
                current_period_end: periodEnd,
                status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', memberRow.id)
            if (resetErr) {
              // Client paid the new period but their allotment wasn't reset — retry.
              return await failMoneyEvent(
                'stripe-webhook membership period reset',
                new Error(resetErr.message),
                { membershipId: memberRow.id, subscriptionId: invoiceSubId }
              )
            }
            break
          }
        }
        // Not a membership invoice — no existing workspace behavior for invoice.paid; no-op.
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        // Membership check first — if this sub belongs to a client membership, handle it
        // and break so the workspace subscriptions table is never touched.
        const { data: memberRow, error: lookupErr } = await supabase
          .from('client_memberships')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (lookupErr) {
          return await failMoneyEvent(
            'stripe-webhook membership status update',
            new Error(`membership lookup failed: ${lookupErr.message}`),
            { subscriptionId: sub.id }
          )
        }
        if (memberRow) {
          moneyEvent = true
          const memberStatus = stripeStatusToMembership(sub.status)
          const periodStart = sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null
          const updatePayload: Record<string, unknown> = {
            status: memberStatus,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          }
          // If the coach scheduled a cancel-at-period-end, record canceled_at but keep
          // status as-is (still active/trialing until the period actually ends).
          if (sub.cancel_at_period_end) {
            updatePayload.canceled_at = new Date().toISOString()
          }
          const { error: memberUpdErr } = await supabase
            .from('client_memberships')
            .update(updatePayload)
            .eq('id', memberRow.id)
          if (memberUpdErr) {
            return await failMoneyEvent(
              'stripe-webhook membership status update',
              new Error(memberUpdErr.message),
              { membershipId: memberRow.id, subscriptionId: sub.id }
            )
          }
          break
        }
        // --- Workspace subscription (unchanged) ---
        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? priceIdToPlan(priceId) ?? 'starter' : 'starter'
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
        const status = (sub.status === 'trialing' ? 'trialing' : sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status === 'canceled' || sub.status === 'unpaid' ? 'cancelled' : 'paused') as 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'

        const { data: row } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (row) {
          await supabase
            .from('subscriptions')
            .update({
              status,
              plan,
              current_period_end: periodEnd,
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        // Membership check first.
        const { data: memberRow, error: lookupErr } = await supabase
          .from('client_memberships')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (lookupErr) {
          return await failMoneyEvent(
            'stripe-webhook membership cancellation',
            new Error(`membership lookup failed: ${lookupErr.message}`),
            { subscriptionId: sub.id }
          )
        }
        if (memberRow) {
          moneyEvent = true
          const { error: cancelUpdErr } = await supabase
            .from('client_memberships')
            .update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', memberRow.id)
          if (cancelUpdErr) {
            // Stripe stopped billing but the membership still looks live — retry.
            return await failMoneyEvent(
              'stripe-webhook membership cancellation',
              new Error(cancelUpdErr.message),
              { membershipId: memberRow.id, subscriptionId: sub.id }
            )
          }
          break
        }
        // --- Workspace subscription (unchanged) ---
        const { data: row } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (row) {
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', row.id)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // Membership check via invoice.subscription (more precise than customer lookup).
        const failedSubId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as Stripe.Subscription | null)?.id ?? null
        if (failedSubId) {
          const { data: memberRow, error: lookupErr } = await supabase
            .from('client_memberships')
            .select('id')
            .eq('stripe_subscription_id', failedSubId)
            .maybeSingle()
          if (lookupErr) {
            return await failMoneyEvent(
              'stripe-webhook membership payment failed',
              new Error(`membership lookup failed: ${lookupErr.message}`),
              { subscriptionId: failedSubId }
            )
          }
          if (memberRow) {
            moneyEvent = true
            const { error: pastDueErr } = await supabase
              .from('client_memberships')
              .update({ status: 'past_due', updated_at: new Date().toISOString() })
              .eq('id', memberRow.id)
            if (pastDueErr) {
              return await failMoneyEvent(
                'stripe-webhook membership payment failed',
                new Error(pastDueErr.message),
                { membershipId: memberRow.id, subscriptionId: failedSubId }
              )
            }
            break
          }
        }
        // --- Workspace (coach) subscription ---
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break
        // Coach dunning is money-critical too: surface failures so Stripe retries
        // instead of silently acking. .limit(1) guards against a customer that
        // somehow maps to >1 subscription row (maybeSingle would otherwise throw).
        moneyEvent = true
        const { data: row, error: wsLookupErr } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1)
          .maybeSingle()
        if (wsLookupErr) {
          return await failMoneyEvent(
            'stripe-webhook workspace payment failed',
            new Error(`subscription lookup failed: ${wsLookupErr.message}`),
            { customerId }
          )
        }
        if (row) {
          const { error: wsPastDueErr } = await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', row.id)
          if (wsPastDueErr) {
            return await failMoneyEvent(
              'stripe-webhook workspace payment failed',
              new Error(wsPastDueErr.message),
              { subscriptionId: row.id, customerId }
            )
          }
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[POST /api/webhooks/stripe] Unhandled error processing event', event.type, err)
    if (moneyEvent) {
      // Money fulfillment blew up (e.g. Stripe retrieve / DB outage) — make it retry.
      return await failMoneyEvent('POST /api/webhooks/stripe', err)
    }
    await logServerError('POST /api/webhooks/stripe', err, { eventType: event.type })
    // Non-money events still ack 200 so Stripe does not retry; error is logged.
  }
  return NextResponse.json({ received: true })
}
