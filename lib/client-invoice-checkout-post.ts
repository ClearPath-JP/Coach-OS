import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { stripe } from '@/lib/stripe'

type ClientSupabase = SupabaseClient

/**
 * Shared handler: authenticated client starts Stripe Checkout for their invoice.
 */
export async function postClientInvoiceCheckoutSession(
  request: Request,
  invoiceId: string,
  user: User,
  clientId: string,
  workspaceId: string,
  supabase: ClientSupabase
): Promise<NextResponse> {
  const { success, retryAfter } = await checkRateLimitAsync(`client-invoice-checkout:${user.id}`, {
    windowMs: 60_000,
    max: 15,
  })
  if (!success) {
    const res = NextResponse.json(
      { error: 'Too many attempts — please wait a minute and try again' },
      { status: 429 }
    )
    if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Card payments are not available right now — try again later or use another method.' },
      { status: 503 }
    )
  }

  const { data: invoice, error: invErr } = await supabase
    .from('session_invoices')
    .select('id, workspace_id, client_id, amount_cents, currency, status')
    .eq('id', invoiceId)
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (invErr || !invoice) {
    return NextResponse.json({ error: "We couldn't find that invoice" }, { status: 404 })
  }
  if (invoice.status !== 'pending') {
    return NextResponse.json({ error: 'This invoice is not awaiting payment' }, { status: 400 })
  }
  if (!invoice.amount_cents || invoice.amount_cents <= 0) {
    return NextResponse.json({ error: 'Invalid invoice amount' }, { status: 400 })
  }

  const productName = 'Coaching invoice'

  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .select('stripe_connect_account_id')
    .eq('id', workspaceId)
    .maybeSingle()

  if (wsErr || !ws) {
    return NextResponse.json({ error: 'Could not load workspace' }, { status: 500 })
  }

  const connectId = (ws.stripe_connect_account_id as string | null)?.trim()
  if (!connectId) {
    return NextResponse.json(
      {
        error:
          'Your coach has not finished connecting Stripe for card payments yet. Use another payment method or message your coach.',
      },
      { status: 400 }
    )
  }

  try {
    const acct = await stripe.accounts.retrieve(connectId)
    if (acct.charges_enabled !== true) {
      return NextResponse.json(
        {
          error:
            'Card payments are not active for this workspace yet. Your coach may still be finishing Stripe setup.',
        },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Could not verify payment setup — try again or use another payment method.' },
      { status: 502 }
    )
  }

  const currency = ((invoice.currency as string) || 'usd').toLowerCase()
  const base = resolveAppBaseUrl(request)

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: invoice.amount_cents,
          product_data: {
            name: productName,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      transfer_data: {
        destination: connectId,
      },
      metadata: {
        type: 'client_invoice',
        invoice_id: invoiceId,
        workspace_id: workspaceId,
        client_id: clientId,
      },
    },
    metadata: {
      type: 'client_invoice',
      invoice_id: invoiceId,
      workspace_id: workspaceId,
      client_id: clientId,
    },
    success_url: `${base}/client/invoices?paid=1`,
    cancel_url: `${base}/client/invoices?cancelled=1`,
  }
  if (user.email) {
    sessionParams.customer_email = user.email
  }

  const checkoutSession = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `invoice_${invoiceId}_checkout_v1`,
  })

  const url = checkoutSession.url
  if (!url) {
    return NextResponse.json({ error: 'Could not start checkout — please try again' }, { status: 502 })
  }

  return NextResponse.json({
    data: {
      url,
      checkoutUrl: url,
    },
  })
}
