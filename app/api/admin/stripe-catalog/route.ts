import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import {
  isStripeSecretKeyConfigured,
  isStripeWebhookSecretConfigured,
  stripeEnvDiagnosticsForAdmin,
} from '@/lib/stripe-env-read'
import { stripe, STRIPE_PRICES, STRIPE_SETUP_FEE_PRICES } from '@/lib/stripe'

type Tier = 'starter' | 'pro' | 'scale'

const TIERS: Tier[] = ['starter', 'pro', 'scale']

const TIER_LABEL: Record<Tier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
}

const MONTHLY_ENV: Record<Tier, string> = {
  starter: 'STRIPE_PRICE_STARTER_ID',
  pro: 'STRIPE_PRICE_PRO_ID',
  scale: 'STRIPE_PRICE_SCALE_ID',
}

const SETUP_ENV: Record<Tier, string> = {
  starter: 'STRIPE_SETUP_FEE_STARTER_ID',
  pro: 'STRIPE_SETUP_FEE_PRO_ID',
  scale: 'STRIPE_SETUP_FEE_SCALE_ID',
}

function productName(product: Stripe.Price['product']): string | null {
  if (!product || typeof product === 'string') return null
  if ('deleted' in product && product.deleted) return null
  return product.name ?? null
}

type PriceRow =
  | { configured: false }
  | {
      configured: true
      priceId: string
      live: null
      error: string
    }
  | {
      configured: true
      priceId: string
      live: {
        active: boolean
        currency: string
        unitAmount: number | null
        interval: string | null
        type: Stripe.Price.Type
        nickname: string | null
        productName: string | null
      }
    }

async function resolvePrice(priceId: string | undefined): Promise<PriceRow> {
  const trimmed = priceId?.trim()
  if (!trimmed) return { configured: false }
  if (!stripe) {
    return {
      configured: true,
      priceId: trimmed,
      live: null,
      error: 'STRIPE_SECRET_KEY is not set — cannot load live price from Stripe.',
    }
  }
  try {
    const p = await stripe.prices.retrieve(trimmed, { expand: ['product'] })
    return {
      configured: true,
      priceId: p.id,
      live: {
        active: p.active,
        currency: p.currency,
        unitAmount: p.unit_amount,
        interval: p.recurring?.interval ?? null,
        type: p.type,
        nickname: p.nickname,
        productName: productName(p.product),
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load price'
    return { configured: true, priceId: trimmed, live: null, error: msg }
  }
}

/**
 * GET /api/admin/stripe-catalog — env price IDs + live Stripe amounts (super-admin only).
 */
export async function GET(request: Request) {
  const auth = await assertAdminApi(request)
  if (auth instanceof NextResponse) return auth

  const plans = await Promise.all(
    TIERS.map(async (tier) => {
      const [monthly, setupFee] = await Promise.all([
        resolvePrice(STRIPE_PRICES[tier]),
        resolvePrice(STRIPE_SETUP_FEE_PRICES[tier]),
      ])
      return {
        tier,
        label: TIER_LABEL[tier],
        monthlyEnv: MONTHLY_ENV[tier],
        setupEnv: SETUP_ENV[tier],
        monthly,
        setupFee,
      }
    })
  )

  await logAdminAudit({
    action: 'admin.stripe_catalog.read',
    userId: auth.id,
    request,
  })

  const vercelEnv = process.env.VERCEL_ENV
  let deploymentHint: string
  if (vercelEnv === 'preview') {
    deploymentHint =
      'This is a Vercel Preview deployment. Environment variables must have the Preview checkbox enabled, or they will appear missing even if Production has them.'
  } else if (vercelEnv === 'production') {
    deploymentHint =
      'Vercel Production. If you just added variables, redeploy — new env values are not picked up until a new deployment runs.'
  } else if (process.env.VERCEL === '1' && vercelEnv === 'development') {
    deploymentHint = 'Vercel CLI / development run.'
  } else if (!process.env.VERCEL) {
    deploymentHint = 'Local dev server — use .env.local and restart npm run dev after changes.'
  } else {
    deploymentHint = 'Server-side env check for this request only.'
  }

  return NextResponse.json({
    data: {
      stripeSecretConfigured: isStripeSecretKeyConfigured(),
      webhookSecretConfigured: isStripeWebhookSecretConfigured(),
      stripeEnvDiagnostics: stripeEnvDiagnosticsForAdmin(),
      connectDefaultCountry: process.env.STRIPE_CONNECT_DEFAULT_COUNTRY?.trim() || 'US',
      envContext: {
        vercelEnv: vercelEnv ?? null,
        deploymentHint,
      },
      billingUiCopy: {
        monthlyDisplay: { starter: '$79', pro: '$149', scale: '$299' },
        setupFeeDisplay: { starter: '$197', pro: '$297', scale: '$397' },
        note: 'Billing page labels are static in BillingPageContent — confirm they match Stripe.',
      },
      plans,
    },
  })
}
