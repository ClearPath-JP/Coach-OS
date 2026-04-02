/**
 * Run from repo root: npx tsx scripts/verify-stripe-env.ts
 * Loads .env.local (if present) and prints safe diagnostics — does not print secret values.
 */
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
config({ path: path.join(root, '.env.local') })
config({ path: path.join(root, '.env') })

function len(name: string): number {
  return (process.env[name] ?? '').replace(/^\uFEFF/, '').trim().length
}

const sk = len('STRIPE_SECRET_KEY')
const alias = len('STRIPE_API_KEY')
const wh = len('STRIPE_WEBHOOK_SECRET')

console.log('Stripe env (lengths only, from .env / .env.local loaded into this process):\n')
console.log(`  STRIPE_SECRET_KEY     ${sk} chars`)
console.log(`  STRIPE_API_KEY        ${alias} chars (optional alias)`)
console.log(`  STRIPE_WEBHOOK_SECRET ${wh} chars`)
console.log('')
if (sk === 0 && alias === 0) {
  console.log('→ No secret key found. Add STRIPE_SECRET_KEY=sk_test_... to .env.local next to package.json')
  process.exitCode = 1
} else if (sk === 0 && alias > 0) {
  console.log('→ Using STRIPE_API_KEY only. Prefer renaming to STRIPE_SECRET_KEY in .env.local for ClearPath.')
}
if (wh === 0) {
  console.log('→ Webhook secret missing. Add STRIPE_WEBHOOK_SECRET=whsec_... from Stripe → Webhooks → signing secret.')
  process.exitCode = 1
} else {
  const raw = (process.env.STRIPE_WEBHOOK_SECRET ?? '').replace(/^\uFEFF/, '').trim()
  if (!raw.startsWith('whsec_')) {
    console.log('→ STRIPE_WEBHOOK_SECRET should start with whsec_ (webhook signing secret), not the API key.')
    process.exitCode = 1
  }
}
if (process.exitCode === 1) {
  console.log('\nAfter fixing .env.local, stop and run: npm run dev')
}
