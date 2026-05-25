'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CountUpValue } from '@/components/ui/CountUpValue'
import { PAYMENT_METHOD_LABELS, type PaymentMethodValue } from '@/lib/payment-methods'
import { formatCents } from '@/lib/format-currency'

function ChartLoadingBlock({ minHeight }: { minHeight: number }) {
  return (
    <div
      className="flex w-full min-w-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[13px] font-medium text-[var(--text-tertiary)]"
      style={{ minHeight }}
      aria-busy
    >
      Loading chart…
    </div>
  )
}

const AnalyticsRevenueChartCard = dynamic(
  () => import('./AnalyticsChartsPanel').then((m) => m.AnalyticsRevenueChartCard),
  {
    ssr: false,
    loading: () => <ChartLoadingBlock minHeight={420} />,
  }
)

const AnalyticsPaymentMethodsChartCard = dynamic(
  () => import('./AnalyticsChartsPanel').then((m) => m.AnalyticsPaymentMethodsChartCard),
  {
    ssr: false,
    loading: () => <ChartLoadingBlock minHeight={260} />,
  }
)
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

type TestimonialRow = {
  id: string
  clientName: string
  content: string
  rating: number | null
  isApproved: boolean
  isPublic: boolean
  createdAt: string
}

function AnalyticsTestimonialsSection() {
  const [rows, setRows] = useState<TestimonialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/testimonials', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load testimonials')
        setRows([])
        return
      }
      setRows(Array.isArray(json.data) ? json.data : [])
    } catch {
      setError('Could not load testimonials')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchRow = async (id: string, body: Record<string, boolean>) => {
    const res = await fetch(`/api/testimonials/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (res.ok) void load()
  }

  const deleteRow = async (id: string) => {
    if (!window.confirm('Delete this testimonial?')) return
    const res = await fetch(`/api/testimonials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) void load()
  }

  return (
    <Card variant="raised" padding="lg">
      <h2 className="mb-2 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-ink)]">Testimonials</h2>
      {loading ? (
        <div className="h-20 animate-pulse rounded-lg bg-[var(--color-border)]/40" />
      ) : error ? (
        <p className="text-[14px] text-[var(--color-error)]">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-[15px] text-[var(--color-muted)]">
          No testimonials yet. They appear here when clients complete programs or reach 30 days.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{t.clientName}</p>
                  <p className="text-[13px] text-[var(--color-muted)]">
                    {t.rating != null ? `${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)} · ` : null}
                    {format(parseISO(t.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="text-[12px] font-medium text-[var(--color-muted)]">
                  {!t.isApproved ? 'Pending approval' : t.isPublic ? 'Public' : 'Approved'}
                </span>
              </div>
              <p className="mt-2 text-[14px] text-[var(--color-ink)] whitespace-pre-wrap">{t.content}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!t.isApproved ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void patchRow(t.id, { isApproved: true })}>
                    Approve
                  </Button>
                ) : null}
                {t.isApproved && !t.isPublic ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void patchRow(t.id, { isPublic: true })}>
                    Make public
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" onClick={() => void deleteRow(t.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ActivityIcon({ kind }: { kind: string }) {
  if (kind === 'payment')
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)]"
        style={{ color: 'var(--success)' }}
        aria-hidden
      >
        $
      </span>
    )
  if (kind === 'session')
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)]"
        style={{ color: 'var(--cp-accent)' }}
        aria-hidden
      >
        ◷
      </span>
    )
  if (kind === 'client')
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--info-bg)]"
        style={{ color: 'var(--info)' }}
        aria-hidden
      >
        +
      </span>
    )
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--warning-bg)]"
      style={{ color: 'var(--warning)' }}
      aria-hidden
    >
      P
    </span>
  )
}

export type AnalyticsPageContentProps = {
  /** Wrap Recharts sections (e.g. with ErrorBoundary) without affecting stat cards. */
  wrapCharts?: (node: ReactNode) => ReactNode
}

type MainTab = 'overview' | 'revenue' | 'clients' | 'sessions' | 'assignments'

type AssignOverview = {
  pendingReviewCount: number
  overdueCount: number
  completionRatePct: number
  topClientsByXp: { clientId: string; name: string; totalXp: number; level: number }[]
}

export function AnalyticsPageContent({ wrapCharts = (n) => n }: AnalyticsPageContentProps) {
  const [mainTab, setMainTab] = useState<MainTab>('overview')
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignOverview, setAssignOverview] = useState<AssignOverview | null>(null)
  const [sessionsForTab, setSessionsForTab] = useState<{ status: string }[]>([])

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

  useEffect(() => {
    void fetch('/api/assignments/overview', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) setAssignOverview(json.data as AssignOverview)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mainTab !== 'sessions') return
    void fetch('/api/coach/sessions', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setSessionsForTab(json.data as { status: string }[])
      })
      .catch(() => setSessionsForTab([]))
  }, [mainTab])

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

  const noDataYet =
    data &&
    summary &&
    data.activeClients === 0 &&
    data.sessionsCompleted === 0 &&
    (summary.totalRevenue ?? 0) === 0

  function exportRevenueCsv() {
    const rows = chartData.filter((r) => r.date)
    const lines = ['Date,RevenueUSD', ...rows.map((r) => `${r.date},${r.dollars}`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clearpath-revenue-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const completedSessionsInSample = sessionsForTab.filter((s) => s.status === 'completed').length
  const mainTabs: { id: MainTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'clients', label: 'Clients' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'assignments', label: 'Assignments' },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6">
      <PageHeader title="Analytics" />

      <div className="flex flex-wrap gap-0 border-b border-[var(--border-subtle)]" role="tablist" aria-label="Analytics views">
        {mainTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mainTab === t.id}
            onClick={() => setMainTab(t.id)}
            className={`relative h-9 px-4 text-[14px] transition-colors duration-150 ${
              mainTab === t.id
                ? 'font-medium text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--cp-accent)]'
                : 'font-normal text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {(['week', 'month', 'year', 'all'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`min-h-11 rounded-full px-4 py-2 text-[14px] font-medium ${
              period === p
                ? 'bg-[var(--cp-accent)] text-[var(--text-on-accent)]'
                : 'border border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-secondary)]'
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
        noDataYet ? (
          mainTab === 'overview' ? (
          <Card variant="raised" padding="lg" className="p-10 text-center">
            <BarChart3 size={32} className="mx-auto text-[var(--accent)]" aria-hidden />
            <h2 className="mt-3 text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Your insights will appear here
            </h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[var(--text-14)] font-normal leading-[1.6] text-[var(--text-tertiary)]">
              Once you have clients and sessions, you&apos;ll see your revenue trends, top clients, and session
              analytics.
            </p>
            <Link
              href="/coach/clients"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--cp-accent)] px-5 text-[14px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--cp-accent-hover)]"
            >
              Add your first client
            </Link>
          </Card>
        ) : (
          <Card variant="raised" padding="lg" className="p-8 text-center">
            <p className="text-[15px] text-[var(--text-tertiary)]">Not enough activity for this view yet. Try a longer period or add clients.</p>
          </Card>
        )
      ) : (
        <>
          {mainTab === 'overview' && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Summary</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card variant="raised" padding="lg">
                  <p className="text-[13px] text-[var(--text-tertiary)]">Total revenue</p>
                  <p className="mt-2 text-[36px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
                    <CountUpValue value={summary.totalRevenue} formatter={(n) => formatCents(Math.round(n))} />
                  </p>
                </Card>
                <Card variant="raised" padding="lg">
                  <p className="text-[13px] text-[var(--text-tertiary)]">Sessions completed</p>
                  <p className="mt-2 text-[36px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
                    <CountUpValue value={data.sessionsCompleted} formatter={(n) => String(Math.round(n))} />
                  </p>
                </Card>
                <Card variant="raised" padding="lg">
                  <p className="text-[13px] text-[var(--text-tertiary)]">Active clients</p>
                  <p className="mt-2 text-[36px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
                    <CountUpValue value={data.activeClients} formatter={(n) => String(Math.round(n))} />
                  </p>
                </Card>
                <Card variant="raised" padding="lg">
                  <p className="text-[13px] text-[var(--text-tertiary)]">Avg revenue per client</p>
                  <p className="mt-2 text-[36px] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
                    <CountUpValue value={data.avgRevenuePerClient} formatter={(n) => formatCents(Math.round(n))} />
                  </p>
                </Card>
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Revenue trend</p>
              {wrapCharts(<AnalyticsRevenueChartCard chartData={chartData} />)}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card variant="raised" padding="lg">
                  <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Top clients by revenue</h2>
                  {topFive.length === 0 ? (
                    <p className="text-[15px] text-[var(--text-tertiary)]">No payments in this period.</p>
                  ) : (
                    <ul className="space-y-4">
                      {topFive.map((c) => {
                        const w = Math.max(8, Math.round((c.total / topMax) * 100))
                        return (
                          <li key={c.clientId}>
                            <div className="flex items-center justify-between gap-2 text-[15px]">
                              <span className="truncate font-medium text-[var(--text-primary)]">{c.clientName}</span>
                              <span className="shrink-0 text-[var(--text-tertiary)]">
                                {formatCents(c.total)} · {c.count} payments
                              </span>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
                              <div className="h-full rounded-full bg-[var(--cp-accent)] transition-[width] duration-700 ease-out" style={{ width: `${w}%` }} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Card>
                {wrapCharts(
                  <AnalyticsPaymentMethodsChartCard donutData={donutData} methodEntries={methodEntries} methodTotal={methodTotal} />
                )}
              </div>

              <Card variant="raised" padding="lg">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Recent activity</h2>
                {data.recentActivity.length === 0 ? (
                  <p className="text-[15px] text-[var(--text-tertiary)]">No recent activity.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.recentActivity.map((item, i) => (
                      <li key={`${item.at}-${i}`} className="flex gap-3">
                        <ActivityIcon kind={item.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] text-[var(--text-primary)]">
                            {item.kind === 'payment' && 'Payment recorded: '}
                            {item.kind === 'client' && 'New client: '}
                            {item.text}
                          </p>
                          <p className="text-[13px] text-[var(--text-tertiary)]">
                            {formatDistanceToNow(parseISO(item.at), { addSuffix: true })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}

          {mainTab === 'revenue' && (
            <>
              <div className="flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={exportRevenueCsv}>
                  Export CSV
                </Button>
              </div>
              {wrapCharts(<AnalyticsRevenueChartCard chartData={chartData} tall />)}
              <Card variant="raised" padding="lg">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Monthly breakdown</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                        <th className="py-2 pr-4">Period</th>
                        <th className="py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData
                        .filter((r) => r.date)
                        .map((r) => (
                          <tr key={r.date} className="border-b border-[var(--border-subtle)]">
                            <td className="py-2 pr-4">{r.label}</td>
                            <td className="py-2 tabular-nums">{formatCents(Math.round(r.total))}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {mainTab === 'clients' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card variant="raised" padding="lg">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Top clients by revenue</h2>
                {topFive.length === 0 ? (
                  <p className="text-[15px] text-[var(--text-tertiary)]">No payments in this period.</p>
                ) : (
                  <ul className="space-y-4">
                    {topFive.map((c) => {
                      const w = Math.max(8, Math.round((c.total / topMax) * 100))
                      return (
                        <li key={c.clientId}>
                          <div className="flex items-center justify-between gap-2 text-[15px]">
                            <span className="truncate font-medium text-[var(--text-primary)]">{c.clientName}</span>
                            <span className="shrink-0 text-[var(--text-tertiary)]">{formatCents(c.total)}</span>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
                            <div className="h-full rounded-full bg-[var(--cp-accent)]" style={{ width: `${w}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
              <Card variant="raised" padding="lg">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">XP leaderboard</h2>
                {!assignOverview?.topClientsByXp?.length ? (
                  <p className="text-[15px] text-[var(--text-tertiary)]">No XP data yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {assignOverview.topClientsByXp.map((c) => (
                      <li key={c.clientId} className="flex items-center justify-between text-[14px]">
                        <Link href={`/coach/clients/${c.clientId}`} className="font-medium text-[var(--cp-accent)] hover:underline">
                          {c.name}
                        </Link>
                        <span className="text-[var(--text-tertiary)]">
                          {c.totalXp} XP · L{c.level}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {mainTab === 'sessions' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card variant="raised" padding="lg" className="lg:col-span-1">
                <p className="text-[13px] text-[var(--text-tertiary)]">Completed (sample window)</p>
                <p className="mt-2 text-[36px] font-bold text-[var(--text-primary)]">{completedSessionsInSample}</p>
                <p className="mt-1 text-[12px] text-[var(--text-quaternary)]">From upcoming sessions API snapshot</p>
              </Card>
              <Card variant="raised" padding="lg" className="lg:col-span-2">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Period summary</h2>
                <p className="text-[14px] text-[var(--text-tertiary)]">
                  Sessions completed in selected period:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">{data.sessionsCompleted}</span>
                </p>
              </Card>
            </div>
          )}

          {mainTab === 'assignments' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card variant="raised" padding="lg">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Completion & queue</h2>
                {!assignOverview ? (
                  <p className="text-[var(--text-tertiary)]">Loading…</p>
                ) : (
                  <ul className="space-y-3 text-[14px] text-[var(--text-secondary)]">
                    <li>Completion rate: {assignOverview.completionRatePct}%</li>
                    <li>Pending review: {assignOverview.pendingReviewCount}</li>
                    <li>Overdue: {assignOverview.overdueCount}</li>
                  </ul>
                )}
              </Card>
              <Card variant="raised" padding="lg">
                <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Top clients by XP</h2>
                {!assignOverview?.topClientsByXp?.length ? (
                  <p className="text-[var(--text-tertiary)]">No data.</p>
                ) : (
                  <ul className="space-y-2 text-[14px]">
                    {assignOverview.topClientsByXp.map((c) => (
                      <li key={c.clientId} className="flex justify-between">
                        <span>{c.name}</span>
                        <span className="text-[var(--text-tertiary)]">{c.totalXp} XP</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
        )
      ) : null}

      <div className="mt-6">
        <AnalyticsTestimonialsSection />
      </div>
    </div>
  )
}
