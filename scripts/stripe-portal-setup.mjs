#!/usr/bin/env node
/**
 * stripe-portal-setup.mjs — create the LIVE Customer Portal *default* configuration
 * on the Korva PLATFORM account, so /api/billing/portal (coach "Manage / cancel")
 * works. Stripe makes the first configuration the default, and the portal route
 * uses the default (it passes no configuration id). Safe to re-run: it refuses to
 * create a second configuration.
 *
 * Guards (protect against writing to the wrong place):
 *   - aborts unless the key resolves to the known PLATFORM account
 *   - aborts unless LIVE mode
 *   - skips if any portal configuration already exists
 *
 * Reads STRIPE_SECRET_KEY from .env.prod.local / .env.local (never printed),
 * same as stripe-verify.mjs. Run:  node scripts/stripe-portal-setup.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Stripe from 'stripe'

const EXPECTED_PLATFORM_ACCT = 'acct_1SDwHVQKTuROR5cI' // Korva platform ("Joshua Potesta")

function loadEnv() {
  const files = ['.env.prod.local', '.env.local', '.env']
  const env = { ...process.env }
  for (const f of files) {
    const p = resolve(process.cwd(), f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      const [, k, rawV] = m
      const v = rawV.replace(/^["']|["']$/g, '')
      if (env[k] === undefined || env[k] === '') env[k] = v
    }
  }
  return env
}

const env = loadEnv()
const key = env.STRIPE_SECRET_KEY
if (!key || !/^(sk|rk)_(live|test)_/.test(key)) {
  console.error('[ABORT] STRIPE_SECRET_KEY missing/invalid. Run: vercel env pull .env.prod.local')
  process.exit(1)
}
const live = key.startsWith('sk_live_')
const stripe = new Stripe(key)

async function main() {
  const acct = await stripe.accounts.retrieve()
  console.log(`Account: ${acct.id} ${acct.business_profile?.name ?? ''}  mode: ${live ? 'LIVE' : 'TEST'}`)

  if (acct.id !== EXPECTED_PLATFORM_ACCT) {
    console.error(`[ABORT] ${acct.id} is not the Korva platform account (${EXPECTED_PLATFORM_ACCT}). Refusing to write.`)
    process.exit(1)
  }
  if (!live) {
    console.error('[ABORT] Not LIVE mode — pull prod env first (vercel env pull .env.prod.local).')
    process.exit(1)
  }

  const existing = await stripe.billingPortal.configurations.list({ limit: 1 })
  if (existing.data.length) {
    console.log(`[SKIP] A portal configuration already exists (${existing.data[0].id}). Not creating another.`)
    process.exit(0)
  }

  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Korva — manage your coaching subscription.',
      privacy_policy_url: 'https://korvacoach.com/privacy',
      terms_of_service_url: 'https://korvacoach.com/terms',
    },
    features: {
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'customer_service', 'too_complex', 'low_quality', 'other'],
        },
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'address', 'name', 'phone'],
      },
    },
  })

  console.log(`[CREATED] ${config.id}  is_default=${config.is_default}  active=${config.active}`)
  console.log('       Coach "Manage / cancel" (/api/billing/portal) will now work.')
  console.log('       Edit anytime in Dashboard → Settings → Billing → Customer portal.')
}

main().catch((e) => { console.error('[FAIL]', e.message); process.exit(1) })
