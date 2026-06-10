#!/usr/bin/env node
/**
 * stripe-verify.mjs — verify the LIVE Stripe money path is wired correctly.
 *
 * Reads STRIPE_SECRET_KEY etc. from .env.prod.local / .env.local at runtime
 * (the secret is never printed). To verify LIVE mode, pull prod env first:
 *
 *   vercel env pull .env.prod.local
 *   node scripts/stripe-verify.mjs
 *
 * Checks, using the `stripe` package already in this project (no new deps):
 *   1. Key mode (live vs test) + platform account status (charges_enabled).
 *   2. Each configured Price ID -> amount / interval / recurring / active / livemode.
 *      Flags the founding price unless it is $99.00/month recurring + active.
 *   3. Webhook endpoints -> finds the prod endpoint, lists enabled events,
 *      flags any required event that is missing (the #1 silent-failure risk).
 *   4. Stripe Connect -> whether enabled + how many connected accounts exist.
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
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
}
const OK = C.g('[ OK ]')
const FAIL = C.r('[FAIL]')
const WARN = C.y('[WARN]')

const key = env.STRIPE_SECRET_KEY
if (!key) {
  console.error(`${FAIL} STRIPE_SECRET_KEY not found. Run:  vercel env pull .env.prod.local`)
  process.exit(1)
}
if (!/^(sk|rk)_(live|test)_/.test(key)) {
  console.error(`${FAIL} STRIPE_SECRET_KEY isn't a Stripe secret/restricted key (expected an sk_/rk_ prefix). Aborting.`)
  process.exit(1)
}
const live = key.startsWith('sk_live_')
const mode = live ? C.g('LIVE') : key.startsWith('sk_test_') ? C.y('TEST') : C.r('UNKNOWN')
const stripe = new Stripe(key)

const PRICE_VARS = {
  founding: env.STRIPE_PRICE_FOUNDING_ID,
  starter: env.STRIPE_PRICE_STARTER_ID,
  pro: env.STRIPE_PRICE_PRO_ID,
  scale: env.STRIPE_PRICE_SCALE_ID,
}
const APP_URL = (env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

function money(amount, currency) {
  if (amount == null) return 'n/a'
  return `${(amount / 100).toFixed(2)} ${String(currency || '').toUpperCase()}`
}
function hostOf(url) {
  try { return new URL(url).host } catch { return '' }
}

async function main() {
  console.log(C.b('\nStripe money-path verification\n'))
  console.log(`${OK} Key mode: ${mode}`)
  if (!live) {
    console.log(`${WARN} Not a live key — you're checking TEST mode. For go-live run:  ${C.d('vercel env pull .env.prod.local')}`)
  }

  // 1. Platform account
  try {
    const acct = await stripe.accounts.retrieve()
    const name = acct.business_profile?.name ? ` (${acct.business_profile.name})` : ''
    console.log(`${OK} Account: ${acct.id}${name}`)
    console.log(C.d(`       charges_enabled=${acct.charges_enabled}  payouts_enabled=${acct.payouts_enabled}  details_submitted=${acct.details_submitted}`))
    if (!acct.charges_enabled) console.log(`${WARN} charges_enabled is false — platform can't take live charges yet.`)
  } catch (e) {
    console.log(`${FAIL} Could not retrieve account: ${e.message}`)
  }

  // 2. Prices
  console.log(C.b('\nPrices'))
  for (const [plan, id] of Object.entries(PRICE_VARS)) {
    if (!id) { console.log(`${WARN} ${plan}: env var not set`); continue }
    if (id.startsWith('prod_')) {
      console.log(`${FAIL} ${plan}: '${id}' is a PRODUCT id, not a price id${plan === 'founding' ? ' — checkout will fail.' : '.'}`)
      try {
        const prices = await stripe.prices.list({ product: id, active: true, limit: 10 })
        if (!prices.data.length) console.log(C.d('        (no active prices under this product)'))
        for (const p of prices.data) {
          const iv = p.recurring ? `/${p.recurring?.interval}` : ' (one-time)'
          console.log(`        ${C.g('→')} set ${plan} to ${C.b(p.id)}  (${money(p.unit_amount, p.currency)}${iv}, ${p.livemode ? 'live' : C.y('test')})`)
        }
      } catch (e) {
        console.log(C.d(`        could not list prices: ${e.message}`))
      }
      continue
    }
    try {
      const price = await stripe.prices.retrieve(id, { expand: ['product'] })
      const interval = price.recurring ? `/${price.recurring.interval}` : ' (one-time)'
      const flags = [price.active ? 'active' : C.r('INACTIVE'), price.livemode ? 'live' : C.y('test')].join(', ')
      const prod = typeof price.product === 'object' ? price.product?.name : price.product
      console.log(`${OK} ${plan}: ${money(price.unit_amount, price.currency)}${interval}  [${flags}]  ${C.d(id)}${prod ? C.d(' — ' + prod) : ''}`)
      if (plan === 'founding') {
        const good = price.unit_amount === 9900 && price.recurring?.interval === 'month' && price.active
        if (!good) console.log(`${WARN} founding expected $99.00/month recurring + active — re-check the line above.`)
        if (live && !price.livemode) console.log(`${FAIL} founding is a TEST price but your key is LIVE — checkout will fail. Set STRIPE_PRICE_FOUNDING_ID to the live price.`)
      }
    } catch (e) {
      console.log(`${FAIL} ${plan} (${id}): ${e.message}`)
    }
  }

  // 3. Webhook endpoints
  console.log(C.b('\nWebhook endpoints'))
  try {
    const list = await stripe.webhookEndpoints.list({ limit: 100 })
    if (!list.data.length) console.log(`${FAIL} No webhook endpoints configured in this mode.`)
    const appHost = hostOf(APP_URL)
    const expected = APP_URL ? `${APP_URL}/api/webhooks/stripe` : ''
    const prod =
      (expected && list.data.find((w) => w.url === expected)) ||
      (appHost && list.data.find((w) => w.url.endsWith('/api/webhooks/stripe') && hostOf(w.url) === appHost)) ||
      list.data.find((w) => w.url.endsWith('/api/webhooks/stripe')) ||
      null
    if (list.has_more) console.log(`${WARN} More than 100 webhook endpoints — only the first page was checked.`)
    for (const w of list.data) {
      console.log(`${OK} ${w.url}  [${w.status}]${w === prod ? C.b(' <= prod') : ''}`)
    }
    if (prod) {
      const enabled = prod.enabled_events || []
      const all = enabled.includes('*')
      const need = ['checkout.session.completed', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted']
      const missing = all ? [] : need.filter((e) => !enabled.includes(e))
      const invoiceOk = all || enabled.includes('invoice.paid') || enabled.includes('invoice.payment_succeeded')
      if (!invoiceOk) missing.push('invoice.paid (or invoice.payment_succeeded)')
      if (all) console.log(`${OK} Sends all events (*) — covered.`)
      else if (missing.length === 0) console.log(`${OK} Prod endpoint has all required events.`)
      else { console.log(`${WARN} Prod endpoint is MISSING required events:`); missing.forEach((e) => console.log(`        - ${e}`)) }
      console.log(C.d(`       enabled: ${all ? '*' : enabled.join(', ') || '(none)'}`))
    } else if (APP_URL) {
      console.log(`${FAIL} No endpoint found for ${APP_URL}/api/webhooks/stripe — live payments won't update your DB.`)
    }
  } catch (e) {
    console.log(`${FAIL} Could not list webhook endpoints: ${e.message}`)
  }

  // 4. Connect
  console.log(C.b('\nStripe Connect'))
  try {
    const accts = await stripe.accounts.list({ limit: 100 })
    const more = accts.has_more ? '+ (first 100 shown)' : ''
    console.log(`${OK} Connect is enabled — ${accts.data.length}${more} connected account(s).`)
    if (accts.data.length) {
      const ready = accts.data.filter((a) => a.charges_enabled).length
      console.log(C.d(`       ${ready} of ${accts.data.length} have completed onboarding (charges_enabled).`))
    }
  } catch (e) {
    if (/connect|platform/i.test(e.message)) console.log(`${WARN} Connect not enabled yet: ${e.message}`)
    else console.log(`${FAIL} Could not list connected accounts: ${e.message}`)
  }

  console.log('')
}

main().catch((e) => { console.error(C.r('verify failed:'), e.message); process.exit(1) })
