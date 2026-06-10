import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Supabase auth ids are always UUIDs — reject anything else before the id is
    // used in Stripe metadata/search (defense in depth).
    if (!UUID_RE.test(user.id)) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`checkout:${user.id}`, {
      windowMs: 60_000,
      max: 5,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many checkout attempts — please wait a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json() as { plan?: string }
    const plan = body.plan as 'founding' | 'starter' | 'pro' | 'scale' | undefined
    if (!plan || !['founding', 'starter', 'pro', 'scale'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
    }

    const priceId = STRIPE_PRICES[plan]
    if (!priceId) {
      return NextResponse.json({ error: `Price not configured for plan: ${plan}` }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin') ?? 'http://localhost:3001'

    // Reuse this user's existing Stripe customer if one exists — retries must not
    // mint duplicate customers. Search is eventually consistent, so fall back to
    // create (with metadata.user_id set so future calls can find it).
    // user.id was validated as a UUID above, so interpolation here is safe.
    let customerId: string | null = null
    try {
      const found = await stripe.customers.search({
        query: `metadata['user_id']:'${user.id}'`,
        limit: 1,
      })
      customerId = found.data[0]?.id ?? null
    } catch (searchErr) {
      console.warn(
        '[new-coach-checkout] customer search failed; creating a new customer',
        searchErr instanceof Error ? searchErr.message : searchErr
      )
    }
    if (!customerId) {
      const customerParams: Stripe.CustomerCreateParams = {
        metadata: { user_id: user.id },
        ...(user.email ? { email: user.email } : {}),
      }
      const customer = await stripe.customers.create(customerParams)
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/api/billing/new-coach-activate?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscribe?cancelled=true`,
        metadata: {
          user_id: user.id,
          plan,
        },
      },
      // Dedupe rapid double-POSTs: same user + price inside Stripe's idempotency
      // window returns the original Checkout session instead of creating a new one.
      { idempotencyKey: `new-coach-checkout:${user.id}:${priceId}` }
    )

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create checkout session' }, { status: 502 })
    }
    return NextResponse.json({ data: { url: session.url } })
  } catch (err) {
    // Same idempotency key with different params (e.g. two simultaneous first-time
    // clicks that created different customers) — tell the caller to retry, don't 500.
    if (err instanceof Stripe.errors.StripeIdempotencyError) {
      return NextResponse.json(
        { error: 'A checkout is already being created — please try again in a moment' },
        { status: 409 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
