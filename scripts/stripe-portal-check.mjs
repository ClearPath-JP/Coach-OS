#!/usr/bin/env node
/**
 * stripe-portal-check.mjs — verify the LIVE Customer Portal is configured on the
 * PLATFORM account, so "cancel anytime from Billing" works. The coach billing
 * route (app/api/billing/portal/route.ts) calls billingPortal.sessions.create
 * WITHOUT a configuration id, so it needs the account's DEFAULT portal config to
 * exist in live mode — otherwise it errors and the cancel/manage button breaks.
 *
 * Read-only. Reads STRIPE_SECRET_KEY from .env.prod.local / .env.local at runtime
 * (the secret is never printed), same pattern as stripe-verify.mjs.
 *
 *   vercel env pull .env.prod.local   # to check LIVE
 *   node scripts/stripe-portal-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Stripe from 'stripe'

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
  console.error('[FAIL] STRIPE_SECRET_KEY missing/invalid. Run: vercel env pull .env.prod.local')
  process.exit(1)
}
const live = key.startsWith('sk_live_')
const stripe = new Stripe(key)

async function main() {
  const acct = await stripe.accounts.retrieve().catch(() => null)
  console.log(`Mode: ${live ? 'LIVE' : 'TEST'}   Account: ${acct?.id ?? '?'} ${acct?.business_profile?.name ?? ''}`)

  const configs = await stripe.billingPortal.configurations.list({ limit: 20 })
  if (!configs.data.length) {
    console.log('[FAIL] No Customer Portal configuration exists in this mode.')
    console.log('       -> /api/billing/portal will error; the coach "Manage / cancel" button breaks.')
    console.log('       -> Fix: Dashboard → Settings → Billing → Customer portal → Save (creates the default), or have me create one via script.')
    process.exit(0)
  }

  let okDefault = false
  for (const c of configs.data) {
    const f = c.features ?? {}
    const tag = c.is_default ? ' (DEFAULT)' : ''
    console.log(`[cfg] ${c.id}${tag}  active=${c.active} livemode=${c.livemode}`)
    console.log(`      cancel=${f.subscription_cancel?.enabled ?? false}  update_payment_method=${f.payment_method_update?.enabled ?? false}  invoice_history=${f.invoice_history?.enabled ?? false}`)
    if (c.is_default && c.active && f.subscription_cancel?.enabled) okDefault = true
  }

  if (okDefault) {
    console.log('[ OK ] Active DEFAULT portal with subscription cancel enabled — "cancel anytime" works.')
  } else {
    console.log('[WARN] No ACTIVE DEFAULT portal config with subscription_cancel enabled.')
    console.log('       The portal route uses the default config — make sure the default is active and has "Cancel subscriptions" turned on.')
  }
}

main().catch((e) => { console.error('[FAIL]', e.message); process.exit(1) })
