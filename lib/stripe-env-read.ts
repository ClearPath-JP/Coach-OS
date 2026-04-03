/**
 * Single place to read Stripe env for the server — trims whitespace, strips UTF-8 BOM,
 * optional STRIPE_API_KEY alias (Stripe CLI / some docs use that name).
 */

import 'server-only'

function stripBomAndTrim(value: string | undefined): string {
  if (value == null) return ''
  return value.replace(/^\uFEFF/, '').trim()
}

/** Secret key: prefer STRIPE_SECRET_KEY, else STRIPE_API_KEY. */
export function readStripeSecretKey(): string {
  const primary = stripBomAndTrim(process.env.STRIPE_SECRET_KEY)
  if (primary) return primary
  return stripBomAndTrim(process.env.STRIPE_API_KEY)
}

export function readStripeWebhookSecret(): string {
  return stripBomAndTrim(process.env.STRIPE_WEBHOOK_SECRET)
}

export function isStripeSecretKeyConfigured(): boolean {
  return readStripeSecretKey().length > 0
}

export function isStripeWebhookSecretConfigured(): boolean {
  return readStripeWebhookSecret().length > 0
}

/** Safe hints for admin Stripe catalog (no secret material). */
export function stripeEnvDiagnosticsForAdmin() {
  const sk = readStripeSecretKey()
  const wh = readStripeWebhookSecret()
  const primarySet = stripBomAndTrim(process.env.STRIPE_SECRET_KEY).length > 0
  const apiKeyAliasSet = stripBomAndTrim(process.env.STRIPE_API_KEY).length > 0
  return {
    secretKeyCharLength: sk.length,
    secretStartsWithSk: sk.startsWith('sk_'),
    usedStripeApiKeyAlias: !primarySet && apiKeyAliasSet && sk.length > 0,
    webhookSecretCharLength: wh.length,
    webhookStartsWithWhsec: wh.startsWith('whsec_'),
  }
}
