import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { checkRateLimitAsync } from '@/lib/rate-limit'

// Matches the columns we read from client_memberships.
interface ClientMembershipRow {
  id: string
  status: string
  stripe_subscription_id: string | null
}

/**
 * POST /api/client/membership-cancel
 * Body: (none)
 *
 * Sets cancel_at_period_end = true on the client's live Stripe subscription so
 * it remains active until the period ends, then cancels automatically. The local
 * client_memberships row is updated optimistically (canceled_at = now()). Status
 * stays unchanged until the webhook flips it at period end.
 *
 * Idempotent: calling again when already cancel_at_period_end = true is harmless.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(
      `membership-cancel:${user.id}`,
      { windowMs: 60_000, max: 10 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — please wait a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Payments unavailable — please try again later' },
        { status: 503 }
      )
    }

    const svc = createServiceClient()

    // Find the client's live membership in this workspace.
    // workspaceId comes from the authenticated client record, not user input.
    const { data: rawMembership, error: membershipErr } = await svc
      .from('client_memberships')
      .select('id, status, stripe_subscription_id')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle()

    if (membershipErr) {
      console.error('POST /api/client/membership-cancel — query', membershipErr)
      return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
    }

    if (!rawMembership) {
      return NextResponse.json(
        { error: 'No active membership found to cancel' },
        { status: 404 }
      )
    }

    const membership = rawMembership as unknown as ClientMembershipRow

    if (!membership.stripe_subscription_id) {
      // Membership row exists but has no Stripe sub yet (e.g. incomplete checkout).
      // Webhook hasn't fired — safe to 404; client should contact coach.
      return NextResponse.json(
        { error: 'Membership payment is still processing — please try again shortly' },
        { status: 404 }
      )
    }

    // Set cancel_at_period_end so the sub stays active until the period ends.
    // Must succeed before we touch the DB — if Stripe fails we return the error
    // and leave the local row unchanged (no state mismatch).
    try {
      await stripe.subscriptions.update(membership.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
    } catch (stripeErr) {
      console.error('POST /api/client/membership-cancel — Stripe update failed', stripeErr)
      return NextResponse.json(
        { error: 'Could not cancel subscription — please try again' },
        { status: 502 }
      )
    }

    // Optimistically record canceled_at. Status stays (active/trialing/past_due)
    // until the webhook fires customer.subscription.deleted at period end.
    const { error: updateErr } = await svc
      .from('client_memberships')
      .update({ canceled_at: new Date().toISOString() })
      .eq('id', membership.id)

    if (updateErr) {
      // Stripe is already updated — log but don't fail the response. The webhook
      // will reconcile the row when the period ends regardless.
      console.error('POST /api/client/membership-cancel — local canceled_at update failed', updateErr)
    }

    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    console.error('POST /api/client/membership-cancel', err)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
