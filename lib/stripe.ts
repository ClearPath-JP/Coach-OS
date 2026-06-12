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

/**
 * Recurring subscription price IDs (monthly) — set in Stripe Dashboard.
 * `.trim()` defends against trailing newlines/spaces that creep into env values
 * when pasted (a real bug: a stray "\n" made Stripe 404 the price).
 */
export const STRIPE_PRICES: Record<'founding' | 'starter' | 'pro' | 'scale', string | undefined> = {
  founding: process.env.STRIPE_PRICE_FOUNDING_ID?.trim(),
  starter: process.env.STRIPE_PRICE_STARTER_ID?.trim(),
  pro: process.env.STRIPE_PRICE_PRO_ID?.trim(),
  scale: process.env.STRIPE_PRICE_SCALE_ID?.trim(),
}

/** One-time setup fee price IDs (optional — omit env to charge subscription only) */
export const STRIPE_SETUP_FEE_PRICES: Record<'founding' | 'starter' | 'pro' | 'scale', string | undefined> = {
  founding: undefined,
  starter: process.env.STRIPE_SETUP_FEE_STARTER_ID,
  pro: process.env.STRIPE_SETUP_FEE_PRO_ID,
  scale: process.env.STRIPE_SETUP_FEE_SCALE_ID,
}
