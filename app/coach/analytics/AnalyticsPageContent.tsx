'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { CountUpValue } from '@/components/ui/CountUpValue'
import { PAYMENT_METHOD_LABELS, type PaymentMethodValue } from '@/lib/payment-methods'
import {
  AnalyticsPaymentMethodsChartCard,
  AnalyticsRevenueChartCard,
} from './AnalyticsChartsPanel'
import { formatCents } from '@/lib/format-currency'
import type { PaymentSummaryResult } from '@/lib/payments-summary'

type Period = 'week' | 'month' | 'year' | 'all'

type AnalyticsPayload = {
  paymentSummary: PaymentSummaryResult
  sessionsCompleted: number
  activeClients: number
  avgRevenuePerClient: number
  recentActivity: { at: string; kind: string; text: string }[]
}

function periodLabel(p: Period): string {
  switch (p) {
    case 'week':
      return 'This week'
    case 'month':
      return 'This month'
    case 'year':
      return 'This year'
    case 'all':
      return 'All time'
    default:
      return ''
  }
}

function chartTick(period: Period, v: string): string {
  if (!v) return '—'
  if (period === 'year' || period === 'all') {
    const [y, m] = v.split('-')
    if (m) return format(parseISO(`${y}-${m}-01`), 'MMM yy')
  }
  try {
    return format(parseISO(v), 'MMM d')
  } catch {
    return v
  }
}

function ActivityIcon({ kind }: { kind: string }) {
  if (kind === 'payment')
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800" aria-hidden>
        $
      </span>
    )
  if (kind === 'session')
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800" aria-hidden>
        ◷
      </span>
    )
  if (kind === 'client')
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800" aria-hidden>
        +
      </span>
    )
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800" aria-hidden>
      P
    </span>
  )
}

export type AnalyticsPageContentProps = {
  /** Wrap Recharts sections (e.g. with ErrorBoundary) without affecting stat cards. */
  wrapCharts?: (node: ReactNode) => ReactNode
}

export function AnalyticsPageContent({ wrapCharts = (n) => n }: AnalyticsPageContentProps) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/coach/analytics?period=${period}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Could not load analytics')
        if (json.data) setData(json.data as AnalyticsPayload)
      } catch {
        setError('Could not load analytics')
      } finally {
        setLoading(false)
      }
    })()
  }, [period])

  const summary = data?.paymentSummary
  const chartDataRaw =
    summary?.byPeriod.map((d) => ({
      ...d,
      label: chartTick(period, d.date),
      dollars: d.total / 100,
    })) ?? []
  const chartData =
    chartDataRaw.length > 0
      ? chartDataRaw
      : [{ date: '', label: '—', total: 0, dollars: 0 }]

  const methodEntries = summary
    ? Object.entries(summary.byMethod).filter(([, v]) => v > 0)
    : []
  const methodTotal = methodEntries.reduce((s, [, v]) => s + v, 0)
  const donutData = methodEntries.map(([name, value]) => ({
    name: PAYMENT_METHOD_LABELS[name as PaymentMethodValue] ?? name,
    value,
    key: name,
  }))

  const topFive = (summary?.byClient ?? []).slice(0, 5)
  const topMax = topFive[0]?.total ?? 1

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6">
      <PageHeader title="Analytics" />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {(['week', 'month', 'year', 'all'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-2 text-[14px] font-medium min-h-[44px] ${
              period === p
                ? 'bg-[var(--color-accent)] text-white'
                : 'border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
            }`}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-[15px] text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-border)]/40" />
          ))}
        </div>
      ) : data && summary ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card variant="raised" padding="lg">
              <p className="text-[14px] text-[var(--color-muted)]">Total revenue</p>
              <p className="mt-1 text-xl font-medium text-[var(--color-ink)]">
                <CountUpValue value={summary.totalRevenue} formatter={(n) => formatCents(Math.round(n))} />
              </p>
            </Card>
            <Card variant="raised" padding="lg">
              <p className="text-[14px] text-[var(--color-muted)]">Sessions completed</p>
              <p className="mt-1 text-xl font-medium text-[var(--color-ink)]">
                <CountUpValue value={data.sessionsCompleted} formatter={(n) => String(Math.round(n))} />
              </p>
            </Card>
            <Card variant="raised" padding="lg">
              <p className="text-[14px] text-[var(--color-muted)]">Active clients</p>
              <p className="mt-1 text-xl font-medium text-[var(--color-ink)]">
                <CountUpValue value={data.activeClients} formatter={(n) => String(Math.round(n))} />
              </p>
            </Card>
            <Card variant="raised" padding="lg">
              <p className="text-[14px] text-[var(--color-muted)]">Avg revenue per client</p>
              <p className="mt-1 text-xl font-medium text-[var(--color-ink)]">
                <CountUpValue value={data.avgRevenuePerClient} formatter={(n) => formatCents(Math.round(n))} />
              </p>
            </Card>
          </div>

          {wrapCharts(<AnalyticsRevenueChartCard chartData={chartData} />)}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="raised" padding="lg">
              <h2 className="text-[15px] font-medium text-[var(--color-ink)] mb-4">Top clients by revenue</h2>
              {topFive.length === 0 ? (
                <p className="text-[15px] text-[var(--color-muted)]">No payments in this period.</p>
              ) : (
                <ul className="space-y-4">
                  {topFive.map((c) => {
                    const w = Math.max(8, Math.round((c.total / topMax) * 100))
                    return (
                      <li key={c.clientId}>
                        <div className="flex items-center justify-between gap-2 text-[15px]">
                          <span className="font-medium text-[var(--color-ink)] truncate">{c.clientName}</span>
                          <span className="shrink-0 text-[var(--color-muted)]">
                            {formatCents(c.total)} · {c.count} payments
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-700 ease-out"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {wrapCharts(
              <AnalyticsPaymentMethodsChartCard
                donutData={donutData}
                methodEntries={methodEntries}
                methodTotal={methodTotal}
              />
            )}
          </div>

          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-ink)] mb-4">Recent activity</h2>
            {data.recentActivity.length === 0 ? (
              <p className="text-[15px] text-[var(--color-muted)]">No recent activity.</p>
            ) : (
              <ul className="space-y-4">
                {data.recentActivity.map((item, i) => (
                  <li key={`${item.at}-${i}`} className="flex gap-3">
                    <ActivityIcon kind={item.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-[var(--color-ink)]">
                        {item.kind === 'payment' && 'Payment recorded: '}
                        {item.kind === 'client' && 'New client: '}
                        {item.text}
                      </p>
                      <p className="text-[13px] text-[var(--color-muted)]">
                        {formatDistanceToNow(parseISO(item.at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </main>
  )
}
