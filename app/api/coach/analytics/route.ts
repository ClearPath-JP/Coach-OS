import { NextResponse } from 'next/server'
import { coachAnalyticsCacheKey, withCache } from '@/lib/api-cache'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { computePaymentSummary } from '@/lib/payments-summary'
import { getSummaryRange, type SummaryPeriod } from '@/lib/payment-period'
import { PAYMENT_METHOD_LABELS, type PaymentMethodValue } from '@/lib/payment-methods'

function nameFrom(
  row:
    | { first_name?: string | null; last_name?: string | null }
    | null
    | undefined
    | { first_name?: string | null; last_name?: string | null }[]
): string {
  const r = Array.isArray(row) ? row[0] : row
  if (!r) return 'Client'
  const n = [r.first_name, r.last_name].filter(Boolean).join(' ')
  return n || 'Client'
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/**
 * GET /api/coach/analytics — dashboard analytics for selected period. Coach only.
 * Query: period=week|month|year|all, startDate=, endDate=
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`coach-analytics:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const ws = coach.workspace_id
    const { searchParams } = new URL(request.url)
    const cacheKey = coachAnalyticsCacheKey(ws, searchParams.toString() || 'default')
    const raw = searchParams.get('period')?.trim() ?? 'month'
    const period: SummaryPeriod = ['week', 'month', 'year', 'all'].includes(raw)
      ? (raw as SummaryPeriod)
      : 'month'
    const startDate = searchParams.get('startDate')?.trim()
    const endDate = searchParams.get('endDate')?.trim()

    const data = await withCache(cacheKey, 300, async () => {
      const range = getSummaryRange(period, startDate, endDate)
      const paymentSummary = await computePaymentSummary(supabase, ws, range)

      const rangeStartIso = range.start.toISOString()
      const rangeEndIso = range.end.toISOString()

      const { count: sessionsCompleted } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws)
        .eq('status', 'completed')
        .gte('updated_at', rangeStartIso)
        .lte('updated_at', rangeEndIso)

      const { count: activeClients } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws)
        .eq('status', 'active')

      const ac = activeClients ?? 0
      const avgRevenuePerClient =
        ac > 0 ? Math.round(paymentSummary.totalRevenue / ac) : 0

      const [payRes, sessRes, cliRes, progRes] = await Promise.all([
        supabase
          .from('payments')
          .select('amount_cents, payment_method, created_at, client_id')
          .eq('workspace_id', ws)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('sessions')
          .select('updated_at, status, clients(first_name, last_name)')
          .eq('workspace_id', ws)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('clients')
          .select('created_at, first_name, last_name')
          .eq('workspace_id', ws)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('client_programs')
          .select('created_at, programs(title), clients(first_name, last_name)')
          .eq('workspace_id', ws)
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      type Act = { at: string; kind: 'payment' | 'session' | 'client' | 'program'; text: string }
      const items: Act[] = []

      for (const p of payRes.data ?? []) {
        const method = p.payment_method as PaymentMethodValue
        const label = PAYMENT_METHOD_LABELS[method] ?? method
        items.push({
          at: (p as { created_at: string }).created_at,
          kind: 'payment',
          text: `Client paid ${formatUsd(p.amount_cents ?? 0)} via ${label}`,
        })
      }
      for (const s of sessRes.data ?? []) {
        const cname = nameFrom(s.clients as Parameters<typeof nameFrom>[0])
        items.push({
          at: (s as { updated_at: string }).updated_at,
          kind: 'session',
          text: `Session with ${cname} completed`,
        })
      }
      for (const c of cliRes.data ?? []) {
        const cname = nameFrom(c)
        items.push({
          at: c.created_at,
          kind: 'client',
          text: `${cname} joined`,
        })
      }
      for (const a of progRes.data ?? []) {
        const cname = nameFrom(a.clients as Parameters<typeof nameFrom>[0])
        const prog = a.programs as { title?: string } | { title?: string }[] | null
        const title = Array.isArray(prog) ? prog[0]?.title ?? 'Program' : prog?.title ?? 'Program'
        items.push({
          at: (a as { created_at: string }).created_at,
          kind: 'program',
          text: `${title} assigned to ${cname}.`,
        })
      }

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      const recentActivity = items.slice(0, 10)

      return {
        paymentSummary,
        sessionsCompleted: sessionsCompleted ?? 0,
        activeClients: ac,
        avgRevenuePerClient,
        recentActivity,
      }
    })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
