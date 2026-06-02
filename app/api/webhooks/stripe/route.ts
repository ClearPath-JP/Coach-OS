import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, STRIPE_WEBHOOK_SECRET, STRIPE_PRICES } from '@/lib/stripe'
import { markSessionInvoicePaidFromStripeCheckout } from '@/lib/stripe-client-invoice-checkout'
import { createSessionFromClassBookingCheckout } from '@/lib/stripe-class-booking-webhook'
import type Stripe from 'stripe'

/**
 * POST /api/webhooks/stripe — Stripe webhook (subscriptions + existing checkout logic).
 * No Supabase session; verify Stripe signature. Use raw body for verification.
 * Always return 200 so Stripe does not retry (log errors internally).
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
    await supabase.from('stripe_webhook_events').insert({ event_id: event.id })
  } catch {
    return NextResponse.json({ received: true })
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
          const result = await createSessionFromClassBookingCheckout(supabase, session)
          if (!result.ok) {
            console.warn('[webhook] class_booking session not created:', result.reason)
          }
          return NextResponse.json({ received: true })
        }
        // --- Client membership checkout ---
        if (session.mode === 'subscription' && session.metadata?.type === 'client_membership') {
          const clientId = session.metadata?.client_id as string | undefined
          const workspaceId = session.metadata?.workspace_id as string | undefined
          const planId = session.metadata?.plan_id as string | undefined
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null
          if (clientId && workspaceId && planId && subId) {
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
            const { data: existingMember } = await supabase
              .from('client_memberships')
              .select('id')
              .eq('stripe_subscription_id', subId)
              .maybeSingle()
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
            const { error: writeErr } = existingMember
              ? await supabase.from('client_memberships').update(membershipRow).eq('id', existingMember.id)
              : await supabase
                  .from('client_memberships')
                  .insert({ ...membershipRow, classes_used_this_period: 0 })
            if (writeErr) {
              console.error('[webhook] client_membership write failed', writeErr)
            }
          } else {
            console.warn('[webhook] client_membership checkout missing metadata', session.metadata)
          }
          return NextResponse.json({ received: true })
        }
        if (session.mode !== 'subscription' || !session.subscription) {
          return NextResponse.json({ received: true })
        }
        const workspaceId = session.metadata?.workspace_id as string | undefined
        const newCoachUserId = session.metadata?.user_id as string | undefined

        // New coach flow — workspace will be created by the activate redirect route
        // The webhook is a backup; the activate route handles it synchronously
        if (!workspaceId && !newCoachUserId) return NextResponse.json({ received: true })
        if (!workspaceId && newCoachUserId) {
          // Workspace activation is handled synchronously in /api/billing/new-coach-activate
          // No action needed here
          return NextResponse.json({ received: true })
        }
        if (!workspaceId) return NextResponse.json({ received: true })

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
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
          const { data: memberRow } = await supabase
            .from('client_memberships')
            .select('id')
            .eq('stripe_subscription_id', invoiceSubId)
            .maybeSingle()
          if (memberRow) {
            // Retrieve subscription to get fresh period boundaries.
            const memberSub = await stripe.subscriptions.retrieve(invoiceSubId)
            const periodStart = memberSub.current_period_start
              ? new Date(memberSub.current_period_start * 1000).toISOString()
              : null
            const periodEnd = memberSub.current_period_end
              ? new Date(memberSub.current_period_end * 1000).toISOString()
              : null
            await supabase
              .from('client_memberships')
              .update({
                classes_used_this_period: 0,
                current_period_start: periodStart,
                current_period_end: periodEnd,
                status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', memberRow.id)
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
        const { data: memberRow } = await supabase
          .from('client_memberships')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (memberRow) {
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
          await supabase
            .from('client_memberships')
            .update(updatePayload)
            .eq('id', memberRow.id)
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
        const { data: memberRow } = await supabase
          .from('client_memberships')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (memberRow) {
          await supabase
            .from('client_memberships')
            .update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', memberRow.id)
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
          const { data: memberRow } = await supabase
            .from('client_memberships')
            .select('id')
            .eq('stripe_subscription_id', failedSubId)
            .maybeSingle()
          if (memberRow) {
            await supabase
              .from('client_memberships')
              .update({ status: 'past_due', updated_at: new Date().toISOString() })
              .eq('id', memberRow.id)
            break
          }
        }
        // --- Workspace subscription (unchanged) ---
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break
        const { data: row } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (row) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', row.id)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[POST /api/webhooks/stripe] Unhandled error processing event', event.type, err)
    // Still return 200 so Stripe does not retry; error is logged for investigation.
  }
  return NextResponse.json({ received: true })
}
