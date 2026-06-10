#!/usr/bin/env node
/**
 * stripe-fix-webhook-events.mjs — ensure the live webhook endpoint sends the
 * events the app handler (app/api/webhooks/stripe/route.ts) consumes.
 *
 * Idempotent: adds only missing events, never removes any. Safe to re-run.
 *
 *   vercel env pull .env.prod.local --environment=production --yes
 *   node scripts/stripe-fix-webhook-events.mjs
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
      const v = m[2].replace(/^["']|["']$/g, '')
      if (env[m[1]] === undefined || env[m[1]] === '') env[m[1]] = v
    }
  }
  return env
}
function hostOf(u) { try { return new URL(u).host } catch { return '' } }

const env = loadEnv()
const key = env.STRIPE_SECRET_KEY
if (!key || !/^(sk|rk)_(live|test)_/.test(key)) {
  console.error('STRIPE_SECRET_KEY missing/invalid. Run: vercel env pull .env.prod.local --environment=production --yes')
  process.exit(1)
}
const stripe = new Stripe(key)
const APP_URL = (env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

// Events consumed by app/api/webhooks/stripe/route.ts
const WANT = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

async function main() {
  const list = await stripe.webhookEndpoints.list({ limit: 100 })
  const appHost = hostOf(APP_URL)
  const expected = APP_URL ? `${APP_URL}/api/webhooks/stripe` : ''
  const ep =
    (expected && list.data.find((w) => w.url === expected)) ||
    (appHost && list.data.find((w) => w.url.endsWith('/api/webhooks/stripe') && hostOf(w.url) === appHost)) ||
    list.data.find((w) => w.url.endsWith('/api/webhooks/stripe')) ||
    null
  if (!ep) {
    console.error('No /api/webhooks/stripe endpoint found in this (live) mode.')
    process.exit(1)
  }

  const current = ep.enabled_events || []
  console.log(`Endpoint: ${ep.url}  (${ep.id})`)
  if (current.includes('*')) { console.log('Already sends all events (*). Nothing to do.'); return }
  console.log(`Current (${current.length}): ${current.join(', ')}`)

  const missing = WANT.filter((e) => !current.includes(e))
  if (!missing.length) { console.log('All required events already enabled. Nothing to do.'); return }

  console.log(`Adding: ${missing.join(', ')}`)
  const merged = Array.from(new Set([...current, ...missing]))
  const updated = await stripe.webhookEndpoints.update(ep.id, { enabled_events: merged })
  const now = updated.enabled_events || []
  console.log(`Done. Now sends ${now.length}: ${now.join(', ')}`)
}

main().catch((e) => { console.error('fix failed:', e.message); process.exit(1) })
