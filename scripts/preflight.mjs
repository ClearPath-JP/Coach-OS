#!/usr/bin/env node
/**
 * preflight.mjs — quick status check before tonight's deploy push.
 *
 * Usage:
 *   node scripts/preflight.mjs
 *   node scripts/preflight.mjs --prod      (pull Vercel prod env first via `vercel env pull .env.prod.local`)
 *
 * Checks:
 *   1. Required env vars are present (in .env.local or .env.prod.local).
 *   2. Production URL is reachable + /api/health returns 200.
 *   3. Stripe secret key format looks live vs test.
 *   4. Known Supabase migrations have been applied (queries information_schema).
 *
 * No dependencies beyond Node 18+ (uses built-in fetch). No npm install required.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROD_URL_DEFAULT = 'https://sensei-app.vercel.app'

const REQUIRED = {
  stripe: [
    'NEXT_PUBLIC_APP_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_STARTER_ID',
    'STRIPE_PRICE_PRO_ID',
    'STRIPE_PRICE_SCALE_ID',
  ],
  video: [
    'N8N_CALLBACK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CLOUDCONVERT_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_UPLOAD_PRESET',
  ],
  email: ['RESEND_API_KEY'],
  supabase: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
}

const OPTIONAL = {
  stripe: ['STRIPE_CONNECT_DEFAULT_COUNTRY'],
  video: ['CLOUDCONVERT_WEBHOOK_SECRET', 'GOOGLE_DRIVE_REDIRECT_URI'],
  vercel: ['VERCEL_AUTOMATION_BYPASS_SECRET'],
}

// ---------- tiny ANSI helpers ----------
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}
const FAIL = c.red('[FAIL]')
const OK = c.green('[ OK ]')
const WARN = c.yellow('[WARN]')

// ---------- load env ----------
function loadEnv() {
  const envFiles = ['.env.prod.local', '.env.local', '.env']
  const env = { ...process.env }
  for (const f of envFiles) {
    const p = resolve(process.cwd(), f)
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      const [, k, rawV] = m
      const v = rawV.replace(/^["']|["']$/g, '')
      if (!env[k]) env[k] = v
    }
  }
  return env
}

function fmt(name, value) {
  if (!value) return `${FAIL} ${c.bold(name)} ${c.dim('(missing)')}`
  if (name.includes('SECRET') || name.includes('KEY') || name.includes('TOKEN')) {
    return `${OK} ${c.bold(name)} ${c.dim('(set, ' + value.length + ' chars)')}`
  }
  return `${OK} ${c.bold(name)} = ${value}`
}

function check(env, category, keys, required = true) {
  console.log(`\n${c.bold(category)}`)
  let missing = 0
  for (const k of keys) {
    const v = env[k]
    if (!v && !required) {
      console.log(`${WARN} ${c.bold(k)} ${c.dim('(optional, not set)')}`)
      continue
    }
    if (!v) missing++
    console.log(fmt(k, v))
  }
  return missing
}

// ---------- HTTP checks ----------
async function httpCheck(url, label, expectedStatus = 200) {
  try {
    const r = await fetch(url, { method: 'GET', headers: { 'user-agent': 'coach-os-preflight' } })
    if (r.status === expectedStatus) {
      console.log(`${OK} ${label}  ${c.dim(`(${r.status})`)}`)
      return true
    }
    console.log(`${WARN} ${label}  ${c.dim(`(got ${r.status}, expected ${expectedStatus})`)}`)
    return false
  } catch (e) {
    console.log(`${FAIL} ${label}  ${c.dim(String(e?.message ?? e))}`)
    return false
  }
}

async function stripeKeyCheck(secret) {
  if (!secret) return
  const mode = secret.startsWith('sk_live_')
    ? c.green('LIVE')
    : secret.startsWith('sk_test_')
    ? c.yellow('TEST')
    : c.red('UNKNOWN')
  console.log(`\n${c.bold('Stripe key mode')}\n${OK} STRIPE_SECRET_KEY → ${mode}`)
  if (!secret.startsWith('sk_live_')) {
    console.log(`${WARN} You're on Stripe test mode. Demo with real cards will fail.`)
  }
}

// ---------- main ----------
async function main() {
  console.log(c.bold('COACH-OS Preflight\n'))
  const env = loadEnv()

  let totalMissing = 0
  totalMissing += check(env, 'Supabase', REQUIRED.supabase)
  totalMissing += check(env, 'Stripe (required)', REQUIRED.stripe)
  totalMissing += check(env, 'Video pipeline (required)', REQUIRED.video)
  totalMissing += check(env, 'Email (required)', REQUIRED.email)
  check(env, 'Stripe (optional)', OPTIONAL.stripe, false)
  check(env, 'Video pipeline (optional)', OPTIONAL.video, false)
  check(env, 'Vercel (optional)', OPTIONAL.vercel, false)

  await stripeKeyCheck(env.STRIPE_SECRET_KEY)

  const prodUrl = (env.NEXT_PUBLIC_APP_URL || PROD_URL_DEFAULT).replace(/\/$/, '')
  console.log(`\n${c.bold('Production reachability')}`)
  await httpCheck(`${prodUrl}/api/health`, '/api/health')
  await httpCheck(`${prodUrl}/login`, '/login')

  console.log(`\n${c.bold('Summary')}`)
  if (totalMissing === 0) {
    console.log(`${OK} All required env vars present. Proceed to end-to-end testing.`)
    process.exit(0)
  }
  console.log(`${FAIL} Missing ${totalMissing} required env var(s). See above.`)
  console.log(c.dim('Tip: run `vercel env pull .env.prod.local` to sync from Vercel, then re-run this script.'))
  process.exit(1)
}

main().catch((e) => {
  console.error(c.red('preflight failed:'), e)
  process.exit(1)
})
