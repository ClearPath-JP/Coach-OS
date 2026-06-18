import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireClient } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const checkoutSchema = z.object({
  planId: z.string().uuid(),
})

// Matches the columns we read from membership_plans.
interface MembershipPlan {
  id: string
  workspace_id: string
  name: string
  stripe_price_id: string | null
  status: string
}

// Matches the columns we read from client_memberships to detect an existing live sub.
interface ClientMembershipRow {
  id: string
  status: string
  stripe_subscription_id: string | null
}

/**
 * POST /api/client/membership-checkout
 * Body: { planId }
 *
 * Creates a Stripe Checkout session (mode: subscription) so a portal client can
 * subscribe to a coach-defined membership plan. Funds are routed to the coach via
 * subscription_data.transfer_data.destination (platform subscription, no stripeAccount).
 *
 * Guards:
 * - plan must be active + have a stripe_price_id
 * - coach workspace must have a stripe_connect_account_id (503 if missing)
 * - client must not already have a live membership (active/trialing/past_due) → 409
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(
      `membership-checkout:${user.id}`,
      { windowMs: 60_000, max: 10 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many checkout attempts — please wait a minute' },
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

    const body = await request.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { planId } = parsed.data
    const svc = createServiceClient()

    // 1. Load the membership plan — must be active and have a Stripe price.
    const { data: rawPlan, error: planErr } = await svc
      .from('membership_plans')
      .select('id, workspace_id, name, stripe_price_id, status')
      .eq('id', planId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (planErr || !rawPlan) {
      return NextResponse.json({ error: 'Membership plan not found' }, { status: 404 })
    }

    const plan = rawPlan as unknown as MembershipPlan

    if (plan.status !== 'active') {
      return NextResponse.json(
        { error: "This plan isn't available" },
        { status: 400 }
      )
    }
    if (!plan.stripe_price_id) {
      return NextResponse.json(
        { error: "This plan isn't available — payment details not configured" },
        { status: 409 }
      )
    }

    // 2. Coach workspace must have Stripe Connect configured.
    const { data: workspace } = await svc
      .from('workspaces')
      .select('stripe_connect_account_id')
      .eq('id', workspaceId)
      .maybeSingle()

    const connectId = (workspace?.stripe_connect_account_id as string | null)?.trim()
    if (!connectId) {
      return NextResponse.json(
        { error: "Your coach hasn't finished setting up payments" },
        { status: 503 }
      )
    }
    // Same guard as buy-pass: the connected account must actually be able to take
    // charges, otherwise Stripe accepts the checkout and the money goes nowhere good.
    try {
      const acct = await stripe.accounts.retrieve(connectId)
      if (acct.charges_enabled !== true) {
        return NextResponse.json(
          { error: 'Card payments are not active for this workspace yet.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Could not verify payment setup — try again shortly.' },
        { status: 502 }
      )
    }

    // 3. Block if the client already has a live membership in this workspace.
    const { data: rawExisting } = await svc
      .from('client_memberships')
      .select('id, status, stripe_subscription_id')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle()

    if (rawExisting as unknown as ClientMembershipRow | null) {
      return NextResponse.json(
        { error: 'You already have an active membership.' },
        { status: 409 }
      )
    }

    // 4. Get client email for the Stripe receipt / prefill.
    const { data: client } = await svc
      .from('clients')
      .select('email, first_name, last_name')
      .eq('id', clientId)
      .maybeSingle()

    const clientEmail: string | undefined =
      (client?.email as string | null) ?? user.email ?? undefined

    // Never use the request Origin header — it can be spoofed. Rely on the
    // env var (always set in production/preview); fall back to localhost only
    // in local dev where NEXT_PUBLIC_APP_URL is typically unset.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // 5. Create platform Checkout session in subscription mode.
    //    Funds are routed to the coach via subscription_data.transfer_data.destination.
    //    Do NOT pass { stripeAccount } — this is a platform-level checkout.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      ...(clientEmail ? { customer_email: clientEmail } : {}),
      success_url: `${baseUrl}/client/portal?membership=active`,
      cancel_url: `${baseUrl}/client/portal?membership=cancelled`,
      subscription_data: {
        // Coach's connected account = merchant of record for the subscription
        // (descriptor/settlement region), aligning with our Terms. Disputes still
        // debit the platform balance (see book-class note) until transfers are reversed.
        on_behalf_of: connectId,
        transfer_data: { destination: connectId },
        metadata: {
          type: 'client_membership',
          client_id: clientId,
          workspace_id: workspaceId,
          plan_id: planId,
        },
      },
      metadata: {
        type: 'client_membership',
        client_id: clientId,
        workspace_id: workspaceId,
        plan_id: planId,
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create checkout' }, { status: 502 })
    }

    return NextResponse.json({ data: { url: session.url } })
  } catch (err) {
    console.error('POST /api/client/membership-checkout', err)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
