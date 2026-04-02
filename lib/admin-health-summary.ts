import type { SupabaseClient } from '@supabase/supabase-js'
import { readStripeSecretKey } from '@/lib/stripe-env-read'

async function timed(fn: () => Promise<unknown>): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now()
  try {
    await fn()
    return { ok: true, ms: Date.now() - t0 }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}

async function checkRedis(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now()
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return { ok: false, ms: Date.now() - t0 }
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return { ok: res.ok, ms: Date.now() - t0 }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}

async function checkStripe(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now()
  const key = readStripeSecretKey()
  if (!key) return { ok: false, ms: Date.now() - t0 }
  // Publishable and webhook secrets are not valid for Dashboard API calls
  if (!key.startsWith('sk_')) return { ok: false, ms: Date.now() - t0 }
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.ok) return { ok: true, ms: Date.now() - t0 }
    // Restricted keys often omit Balance read; Products list is a lighter second check
    if (res.status === 403) {
      const res2 = await fetch('https://api.stripe.com/v1/products?limit=1', {
        headers: { Authorization: `Bearer ${key}` },
      })
      return { ok: res2.ok, ms: Date.now() - t0 }
    }
    return { ok: false, ms: Date.now() - t0 }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}

async function checkResend(): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now()
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, ms: Date.now() - t0 }
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    })
    return { ok: res.ok || res.status === 403, ms: Date.now() - t0 }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}

export type AdminHealthSummary = {
  checkedAt: string
  platformHealthOk: boolean
  /** Service keys that are failing (not OK). */
  failing: string[]
  /** Service keys that are slow but OK (>500ms). */
  slow: string[]
  services: Record<string, { ok: boolean; ms: number }>
}

const SLOW_MS = 500

/**
 * Lightweight health snapshot for polling (overview card, etc.).
 */
export async function runAdminHealthSummary(service: SupabaseClient): Promise<AdminHealthSummary> {
  const checkedAt = new Date().toISOString()

  const db = await timed(async () => {
    const r = await service.from('workspaces').select('id').limit(1)
    if (r.error) throw r.error
  })
  const authSvc = await timed(async () => {
    const r = await service.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (r.error) throw r.error
  })
  const storage = await timed(async () => {
    const r = await service.storage.listBuckets()
    if (r.error) throw r.error
  })
  const redis = await checkRedis()
  const stripe = await checkStripe()
  const resend = await checkResend()

  const map = {
    database: db,
    auth: authSvc,
    storage: storage,
    redis,
    stripe,
    resend,
  } as const

  const services: Record<string, { ok: boolean; ms: number }> = {}
  const failing: string[] = []
  const slow: string[] = []
  for (const [key, v] of Object.entries(map)) {
    services[key] = { ok: v.ok, ms: v.ms }
    if (!v.ok) failing.push(key)
    else if (v.ms > SLOW_MS) slow.push(key)
  }

  const platformHealthOk = failing.length === 0

  return { checkedAt, platformHealthOk, failing, slow, services }
}
