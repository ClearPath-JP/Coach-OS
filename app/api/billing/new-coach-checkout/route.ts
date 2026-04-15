import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { plan?: string }
    const plan = body.plan as 'starter' | 'pro' | 'scale' | undefined
    if (!plan || !['starter', 'pro', 'scale'].includes(plan)) {
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

    // Create a Stripe customer for this user
    const customerParams: Stripe.CustomerCreateParams = {
      metadata: { user_id: user.id },
      ...(user.email ? { email: user.email } : {}),
    }
    const customer = await stripe.customers.create(customerParams)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/api/billing/new-coach-activate?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscribe?cancelled=true`,
      metadata: {
        user_id: user.id,
        plan,
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create checkout session' }, { status: 502 })
    }
    return NextResponse.json({ data: { url: session.url } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
