import type { SupabaseClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'
import { getBucketsForRange, toDateString, type PeriodBucket } from '@/lib/payment-period'
export type PaymentSummaryResult = {
  totalRevenue: number
  totalPayments: number
  byMethod: Record<string, number>
  byClient: {
    clientId: string
    clientName: string
    total: number
    count: number
  }[]
  byPeriod: { date: string; total: number }[]
}

export async function computePaymentSummary(
  supabase: SupabaseClient,
  workspaceId: string,
  range: { start: Date; end: Date },
  options?: { clientId?: string }
): Promise<PaymentSummaryResult> {
  const startStr = toDateString(range.start)
  const endStr = toDateString(range.end)

  let q = supabase
    .from('payments')
    .select('amount_cents, payment_method, payment_date, client_id')
    .eq('workspace_id', workspaceId)
    .gte('payment_date', startStr)
    .lte('payment_date', endStr)

  if (options?.clientId) {
    q = q.eq('client_id', options.clientId)
  }

  const { data: rows, error } = await q

  if (error) {
    throw new Error(error.message)
  }

  const list = rows ?? []
  const totalRevenue = list.reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const totalPayments = list.length

  const byMethod: Record<string, number> = {}
  for (const r of list) {
    const m = r.payment_method as string
    byMethod[m] = (byMethod[m] ?? 0) + (r.amount_cents ?? 0)
  }

  const byClientMap = new Map<string, { name: string; total: number; count: number }>()
  for (const r of list) {
    const id = r.client_id as string
    const name = 'Client'
    const prev = byClientMap.get(id) ?? { name, total: 0, count: 0 }
    prev.total += r.amount_cents ?? 0
    prev.count += 1
    prev.name = name
    byClientMap.set(id, prev)
  }
  const byClient = [...byClientMap.entries()]
    .map(([clientId, v]) => ({
      clientId,
      clientName: v.name,
      total: v.total,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total)

  const { bucket, keys } = getBucketsForRange(range.start, range.end)
  const totals = new Map<string, number>()
  for (const k of keys) totals.set(k, 0)

  for (const r of list) {
    const pd = r.payment_date as string
    const d = parseISO(pd)
    const key =
      bucket === 'month'
        ? format(d, 'yyyy-MM')
        : toDateString(d)
    if (!totals.has(key)) continue
    totals.set(key, (totals.get(key) ?? 0) + (r.amount_cents ?? 0))
  }

  const byPeriod = keys.map((date) => ({
    date,
    total: totals.get(date) ?? 0,
  }))

  return {
    totalRevenue,
    totalPayments,
    byMethod,
    byClient,
    byPeriod,
  }
}

export function emptyPaymentSummary(_bucket: PeriodBucket, keys: string[]): PaymentSummaryResult {
  const byPeriod = keys.map((date) => ({ date, total: 0 }))
  return {
    totalRevenue: 0,
    totalPayments: 0,
    byMethod: {},
    byClient: [],
    byPeriod,
  }
}
