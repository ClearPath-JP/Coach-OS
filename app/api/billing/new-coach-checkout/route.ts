import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** New coaches get a 14-day free trial; Stripe collects the card up front and auto-charges $99/mo when it ends. */
const TRIAL_PERIOD_DAYS = 14

/**
 * Stripe Checkout needs a *price* id, but a product id (prod_…) is an easy env
 * paste-mistake that 500s the founding checkout. Accept either: a price id is
 * used as-is; a product id is resolved to that product's price (its
 * default_price, else its single active recurring price). Throws a clear error
 * if it can't resolve unambiguously, so the failure is legible, not a raw 500.
 */
async function resolveCheckoutPriceId(client: Stripe, configured: string): Promise<string> {
  if (configured.startsWith('price_')) return configured
  if (!configured.startsWith('prod_')) return configured // unknown shape — let Stripe reject it
  const product = await client.products.retrieve(configured)
  const def = product.default_price
  if (typeof def === 'string' && def) return def
  if (def && typeof def === 'object' && 'id' in def && def.id) return def.id
  const prices = await client.prices.list({ product: configured, active: true, limit: 10 })
  const recurring = prices.data.filter((p) => p.recurring)
  const only = recurring[0]
  if (recurring.length === 1 && only) return only.id
  if (recurring.length > 1) {
    throw new Error('This plan points to a product with multiple prices — set the STRIPE_PRICE_* env to a specific price id.')
  }
  throw new Error('This plan is not set up correctly in Stripe (no active recurring price).')
}

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

    const configuredPrice = STRIPE_PRICES[plan]
    if (!configuredPrice) {
      return NextResponse.json({ error: `Price not configured for plan: ${plan}` }, { status: 500 })
    }
    // Tolerate a product id being configured instead of a price id (resolves to the price).
    let priceId: string
    try {
      priceId = await resolveCheckoutPriceId(stripe, configuredPrice)
    } catch (resolveErr) {
      return NextResponse.json(
        { error: resolveErr instanceof Error ? resolveErr.message : 'Price misconfigured' },
        { status: 500 }
      )
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
        // 14-day free trial: the card is collected now (Checkout's default
        // payment_method_collection: 'always'), but the first charge is deferred to the
        // trial end, when Stripe auto-converts the subscription from trialing → active.
        subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS },
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
