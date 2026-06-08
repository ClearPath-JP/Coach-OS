import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { buyPassSchema } from '@/lib/validations'

/**
 * POST /api/client/buy-pass
 * Body: { passId }
 *
 * Creates a one-time Stripe Checkout for the client to buy a class-credit pass. Funds route
 * to the coach's connected account (destination charge, 0% platform fee — consistent with
 * class booking + invoices). On payment success, the webhook (metadata.type 'pass_purchase')
 * credits the client_passes balance. Repeat purchases are allowed and stack (additive).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`buy-pass:${user.id}`, {
      windowMs: 60_000,
      max: 10,
    })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many attempts — please wait a minute' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Card payments are not available right now — try again later.' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = buyPassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const { passId } = parsed.data
    const service = createServiceClient()

    // Load the pass — must belong to this client's workspace and be active.
    const { data: pass } = await service
      .from('class_passes')
      .select('id, title, price_cents, currency, credit_count, expires_in_days, status, workspace_id')
      .eq('id', passId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!pass || pass.status !== 'active') {
      return NextResponse.json({ error: 'That pass is not available' }, { status: 404 })
    }
    if (!pass.price_cents || pass.price_cents <= 0) {
      return NextResponse.json({ error: "This pass can't be purchased online." }, { status: 400 })
    }

    // Coach must have Stripe Connect set up + charges enabled.
    const { data: workspace } = await service
      .from('workspaces')
      .select('stripe_connect_account_id')
      .eq('id', workspaceId)
      .maybeSingle()
    const connectId = (workspace?.stripe_connect_account_id as string | null)?.trim()
    if (!connectId) {
      return NextResponse.json(
        { error: 'Your coach has not finished setting up payments yet.' },
        { status: 503 }
      )
    }
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

    const { data: client } = await service
      .from('clients')
      .select('email')
      .eq('id', clientId)
      .maybeSingle()

    const base = resolveAppBaseUrl(request)
    const currency = ((pass.currency as string) || 'usd').toLowerCase()
    // Stripe metadata values must be strings.
    const passMeta = {
      type: 'pass_purchase',
      pass_id: pass.id as string,
      client_id: clientId,
      workspace_id: workspaceId,
      credit_count: String(pass.credit_count),
      expires_in_days: pass.expires_in_days != null ? String(pass.expires_in_days) : '',
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: pass.price_cents,
            product_data: {
              name: pass.title,
              description: `${pass.credit_count}-class pass`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: client?.email ?? user.email ?? undefined,
      success_url: `${base}/client/passes?purchased=1`,
      cancel_url: `${base}/client/passes?cancelled=1`,
      payment_intent_data: {
        transfer_data: { destination: connectId },
        metadata: passMeta,
      },
      metadata: passMeta,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout — please try again' }, { status: 502 })
    }
    return NextResponse.json({ data: { url: session.url } })
  } catch (err) {
    console.error('POST /api/client/buy-pass', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
