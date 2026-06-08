import { createPassFromCheckout } from '@/lib/stripe-pass-purchase-webhook'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Pure-ish unit tests for pass-purchase fulfillment. No live DB — a tiny in-memory fake
// Supabase models the only two query chains the helper uses:
//   select('id').eq('stripe_checkout_id', id).maybeSingle()   (idempotency check)
//   insert(row).select('id').single()                         (credit the balance)
// The unique stripe_checkout_id column is simulated as a 23505 on duplicate insert.

type Row = Record<string, unknown> & { id: string; stripe_checkout_id?: string }

function makeFakeSupabase() {
  const rows: Row[] = []
  let nextId = 1
  const client = {
    from(table: string) {
      if (table !== 'client_passes') throw new Error(`unexpected table: ${table}`)
      return {
        select() {
          return {
            eq(_col: string, val: string) {
              return {
                async maybeSingle() {
                  const found = rows.find((r) => r.stripe_checkout_id === val)
                  return { data: found ? { id: found.id } : null, error: null }
                },
              }
            },
          }
        },
        insert(row: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  const checkoutId = row.stripe_checkout_id as string | undefined
                  if (checkoutId && rows.some((r) => r.stripe_checkout_id === checkoutId)) {
                    return { data: null, error: { code: '23505', message: 'duplicate key' } }
                  }
                  const id = `cp_${nextId++}`
                  rows.push({ id, ...row })
                  return { data: { id }, error: null }
                },
              }
            },
          }
        },
      }
    },
    __rows: rows,
  }
  return client
}

function fakeSession(id: string, metadata: Record<string, string>): Stripe.Checkout.Session {
  return { id, metadata } as unknown as Stripe.Checkout.Session
}

const META = {
  type: 'pass_purchase',
  pass_id: 'pass-1',
  client_id: 'client-1',
  workspace_id: 'ws-1',
  credit_count: '10',
  expires_in_days: '',
}

describe('createPassFromCheckout', () => {
  it('credits a new pass with the right balance', async () => {
    const db = makeFakeSupabase()
    const res = await createPassFromCheckout(db as unknown as SupabaseClient, fakeSession('cs_1', META))
    expect(res.ok).toBe(true)
    expect(db.__rows).toHaveLength(1)
    const row = db.__rows[0]!
    expect(row.credits_total).toBe(10)
    expect(row.credits_remaining).toBe(10)
    expect(row.status).toBe('active')
    expect(row.pass_id).toBe('pass-1')
    expect(row.client_id).toBe('client-1')
    expect(row.workspace_id).toBe('ws-1')
    expect(row.stripe_checkout_id).toBe('cs_1')
    expect(row.expires_at).toBeNull()
  })

  it('is idempotent — same checkout session never double-credits', async () => {
    const db = makeFakeSupabase()
    const first = await createPassFromCheckout(db as unknown as SupabaseClient, fakeSession('cs_dup', META))
    const second = await createPassFromCheckout(db as unknown as SupabaseClient, fakeSession('cs_dup', META))
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(db.__rows).toHaveLength(1)
  })

  it('is additive — different purchases stack as separate rows', async () => {
    const db = makeFakeSupabase()
    await createPassFromCheckout(db as unknown as SupabaseClient, fakeSession('cs_a', META))
    await createPassFromCheckout(db as unknown as SupabaseClient, fakeSession('cs_b', META))
    expect(db.__rows).toHaveLength(2)
  })

  it('sets expires_at when expires_in_days is provided', async () => {
    const db = makeFakeSupabase()
    await createPassFromCheckout(
      db as unknown as SupabaseClient,
      fakeSession('cs_exp', { ...META, expires_in_days: '30' })
    )
    const row = db.__rows[0]!
    expect(typeof row.expires_at).toBe('string')
    const ms = new Date(row.expires_at as string).getTime() - Date.now()
    // ~30 days out (allow generous slack for test runtime).
    expect(ms).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect(ms).toBeLessThan(31 * 24 * 60 * 60 * 1000)
  })

  it('rejects missing/invalid metadata without writing a row', async () => {
    const db = makeFakeSupabase()
    const res = await createPassFromCheckout(
      db as unknown as SupabaseClient,
      fakeSession('cs_bad', { type: 'pass_purchase' })
    )
    expect(res.ok).toBe(false)
    expect(db.__rows).toHaveLength(0)
  })

  it('rejects a zero/negative credit count', async () => {
    const db = makeFakeSupabase()
    const res = await createPassFromCheckout(
      db as unknown as SupabaseClient,
      fakeSession('cs_zero', { ...META, credit_count: '0' })
    )
    expect(res.ok).toBe(false)
    expect(db.__rows).toHaveLength(0)
  })
})
