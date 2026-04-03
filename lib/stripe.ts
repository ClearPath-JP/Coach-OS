/**
 * Stripe client and config for billing (Checkout, Customer Portal, webhooks).
 * Use STRIPE_SECRET_KEY server-side only; never expose to the client.
 */

import 'server-only'

import Stripe from 'stripe'
import { readStripeSecretKey, readStripeWebhookSecret } from '@/lib/stripe-env-read'

const secret = readStripeSecretKey()

export const stripe = secret ? new Stripe(secret) : null

export const STRIPE_WEBHOOK_SECRET = readStripeWebhookSecret()

/** Recurring subscription price IDs (monthly) — set in Stripe Dashboard */
export const STRIPE_PRICES: Record<'starter' | 'pro' | 'scale', string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER_ID,
  pro: process.env.STRIPE_PRICE_PRO_ID,
  scale: process.env.STRIPE_PRICE_SCALE_ID,
}

/** One-time setup fee price IDs (optional — omit env to charge subscription only) */
export const STRIPE_SETUP_FEE_PRICES: Record<'starter' | 'pro' | 'scale', string | undefined> = {
  starter: process.env.STRIPE_SETUP_FEE_STARTER_ID,
  pro: process.env.STRIPE_SETUP_FEE_PRO_ID,
  scale: process.env.STRIPE_SETUP_FEE_SCALE_ID,
}
