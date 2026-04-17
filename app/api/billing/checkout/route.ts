import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { billingCheckoutSchema } from '@/lib/validations'
import { stripe, STRIPE_PRICES, STRIPE_SETUP_FEE_PRICES } from '@/lib/stripe'

/**
 * POST /api/billing/checkout — create Stripe Checkout session for subscription (coach only).
 * Body: { plan: 'starter' | 'pro' | 'scale' }.
 * Rate limit: 10 per hour per user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`billing-checkout:${user.id}`, {
      windowMs: 60 * 60 * 1000,
      max: 10,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait an hour and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const parsed = billingCheckoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid plan — must be starter, pro, or scale' },
        { status: 400 }
      )
    }
    const key = parsed.data.plan === 'founding' ? 'founding' : parsed.data.plan
    const priceId = STRIPE_PRICES[key]
    if (!priceId || !stripe) {
      return NextResponse.json(
        { error: 'Billing is not configured — please try again later' },
        { status: 500 }
      )
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', coach.workspace_id)
      .maybeSingle()

    let stripeCustomerId = workspace?.stripe_customer_id ?? null
    if (!stripeCustomerId) {
      const createParams: Stripe.CustomerCreateParams = {
        metadata: { workspace_id: coach.workspace_id },
      }
      if (user.email) {
        createParams.email = user.email
      }
      const customer = await stripe.customers.create(createParams)
      stripeCustomerId = customer.id
      const { error: updateErr } = await supabase
        .from('workspaces')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', coach.workspace_id)
      if (updateErr) {
        return NextResponse.json(
          { error: 'Could not save billing account — please try again' },
          { status: 500 }
        )
      }
    }

    // NEXT_PUBLIC_APP_URL must be set in prod; origin fallback covers local dev.
    // Removed stale clearpath.com fallback — would redirect Stripe checkout to a dead domain.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin')
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Billing is not configured — contact support (missing app URL)' },
        { status: 500 }
      )
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: priceId, quantity: 1 }]
    const setupPriceId = STRIPE_SETUP_FEE_PRICES[key]?.trim()
    if (setupPriceId) {
      lineItems.push({ price: setupPriceId, quantity: 1 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: lineItems,
      success_url: `${baseUrl}/coach/subscription?success=true`,
      cancel_url: `${baseUrl}/coach/subscription?cancelled=true`,
      metadata: { workspace_id: coach.workspace_id },
    })

    const url = session.url
    if (!url) {
      return NextResponse.json(
        { error: 'Could not create checkout session — please try again' },
        { status: 502 }
      )
    }
    return NextResponse.json({ data: { url } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
