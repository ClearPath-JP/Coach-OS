'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { StatusDot } from '@/components/ui/StatusDot'
import { RecordPaymentModal, type EditingPayment } from '@/components/coach/RecordPaymentModal'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_STYLES,
  type PaymentMethodValue,
} from '@/lib/payment-methods'
import { formatCents } from '@/lib/format-currency'
import { getSummaryRange, toDateString } from '@/lib/payment-period'
import type { PaymentSummaryResult } from '@/lib/payments-summary'

type PaymentRow = {
  id: string
  client_id: string
  invoice_id: string | null
  session_id: string | null
  amount_cents: number
  payment_method: string
  payment_reference: string | null
  notes: string | null
  payment_date: string
  clients: { first_name: string | null; last_name: string | null } | null
}

type ClientOpt = { id: string; first_name: string | null; last_name: string | null }

function clientName(c: { first_name: string | null; last_name: string | null } | null): string {
  if (!c) return '—'
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ')
  return n || '—'
}

type DatePreset = 'week' | 'month' | 'year' | 'custom'

function InputDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-[var(--color-muted)]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] rounded-lg border border-[var(--color-border)] px-3 py-2 text-[15px]"
      />
    </label>
  )
}

function PresetChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-full px-3 py-1.5 text-[13px] font-medium ${
        active
          ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
          : 'border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]'
      }`}
    >
      {label}
    </button>
  )
}

function PaymentsFilterFields({
  datePreset,
  setDatePreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  clientFilter,
  setClientFilter,
  methodFilter,
  setMethodFilter,
  clients,
}: {
  datePreset: DatePreset
  setDatePreset: (p: DatePreset) => void
  customStart: string
  setCustomStart: (v: string) => void
  customEnd: string
  setCustomEnd: (v: string) => void
  clientFilter: string
  setClientFilter: (v: string) => void
  methodFilter: string
  setMethodFilter: (v: string) => void
  clients: ClientOpt[]
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
      <div>
        <p className="mb-2 text-[13px] font-medium text-[var(--color-muted)]">Date range</p>
        <div className="flex flex-wrap gap-2">
          <PresetChip active={datePreset === 'week'} label="This week" onClick={() => setDatePreset('week')} />
          <PresetChip active={datePreset === 'month'} label="This month" onClick={() => setDatePreset('month')} />
          <PresetChip active={datePreset === 'year'} label="This year" onClick={() => setDatePreset('year')} />
          <PresetChip active={datePreset === 'custom'} label="Custom" onClick={() => setDatePreset('custom')} />
        </div>
      </div>
      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <InputDate label="From" value={customStart} onChange={setCustomStart} />
          <InputDate label="To" value={customEnd} onChange={setCustomEnd} />
        </div>
      )}
      <div className="flex flex-wrap gap-2 md:ml-auto">
        <select
          className="min-h-[44px] min-w-[160px] rounded-lg border border-[var(--color-border)] px-3 py-2 text-[15px]"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client'}
            </option>
          ))}
        </select>
        <select
          className="min-h-[44px] min-w-[160px] rounded-lg border border-[var(--color-border)] px-3 py-2 text-[15px]"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          aria-label="Filter by method"
        >
          <option value="">All methods</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function PaymentsPageContent() {
  const [kpiWeek, setKpiWeek] = useState(0)
  const [kpiMonth, setKpiMonth] = useState(0)
  const [kpiAll, setKpiAll] = useState(0)
  const [pendingCents, setPendingCents] = useState(0)

  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterSummary, setFilterSummary] = useState<PaymentSummaryResult | null>(null)

  const [clientFilter, setClientFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [clients, setClients] = useState<ClientOpt[]>([])

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EditingPayment | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const loadKpis = useCallback(() => {
    Promise.all([
      fetch('/api/payments/summary?period=week').then((r) => r.json()),
      fetch('/api/payments/summary?period=month').then((r) => r.json()),
      fetch('/api/payments/summary?period=all').then((r) => r.json()),
      fetch('/api/invoices?status=pending').then((r) => r.json()),
    ]).then(([w, m, a, inv]) => {
      if (w.data) setKpiWeek(w.data.totalRevenue ?? 0)
      if (m.data) setKpiMonth(m.data.totalRevenue ?? 0)
      if (a.data) setKpiAll(a.data.totalRevenue ?? 0)
      const list = Array.isArray(inv.data) ? inv.data : []
      setPendingCents(list.reduce((s: number, i: { amount_cents: number }) => s + (i.amount_cents ?? 0), 0))
    })
  }, [])

  const loadFilterSummary = useCallback(() => {
    const params = new URLSearchParams()
    if (datePreset === 'custom') {
      if (customStart) params.set('startDate', customStart)
      if (customEnd) params.set('endDate', customEnd)
    } else {
      params.set('period', datePreset)
    }
    fetch(`/api/payments/summary?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setFilterSummary(json.data as PaymentSummaryResult)
      })
      .catch((err) => {
        console.error('Load payment filter summary failed:', err)
        setFilterSummary(null)
      })
  }, [datePreset, customStart, customEnd])

  const loadPayments = useCallback(
    async (nextOffset: number, append: boolean) => {
      const params = new URLSearchParams()
      params.set('offset', String(nextOffset))
      if (clientFilter) params.set('clientId', clientFilter)
      if (methodFilter) params.set('method', methodFilter)
      if (datePreset === 'custom') {
        if (customStart) params.set('startDate', customStart)
        if (customEnd) params.set('endDate', customEnd)
      } else {
        const { start, end } = getSummaryRange(datePreset)
        params.set('startDate', toDateString(start))
        params.set('endDate', toDateString(end))
      }
      const res = await fetch(`/api/payments?${params}`)
      const json = await res.json()
      if (!res.ok) return
      const data = (json.data ?? []) as PaymentRow[]
      if (append) setRows((prev) => [...prev, ...data])
      else setRows(data)
      setHasMore(Boolean(json.hasMore))
      setOffset(json.nextOffset ?? nextOffset + data.length)
    },
    [clientFilter, methodFilter, datePreset, customStart, customEnd]
  )

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setClients(json.data)
      })
      .catch((err) => {
        console.error('Load clients for payments failed:', err)
        setToast('Could not load client list')
      })
  }, [])

  useEffect(() => {
    loadFilterSummary()
  }, [loadFilterSummary])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setOffset(0)
      try {
        await loadPayments(0, false)
      } finally {
        setLoading(false)
      }
    })()
  }, [clientFilter, methodFilter, datePreset, customStart, customEnd, loadPayments])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const methodTotal = filterSummary
    ? Object.values(filterSummary.byMethod).reduce((a, b) => a + b, 0)
    : 0

  const methodSegments = filterSummary
    ? Object.entries(filterSummary.byMethod)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
    : []

  const openEdit = (p: PaymentRow) => {
    setEditing({
      id: p.id,
      clientId: p.client_id,
      amountCents: p.amount_cents,
      paymentMethod: p.payment_method as PaymentMethodValue,
      paymentReference: p.payment_reference,
      notes: p.notes,
      paymentDate: p.payment_date,
      invoiceId: p.invoice_id,
      sessionId: p.session_id,
    })
    setModalOpen(true)
  }

  const handleDelete = async (p: PaymentRow) => {
    const ok = typeof window !== 'undefined' && window.confirm('Delete this payment record?')
    if (!ok) return
    const res = await fetch(`/api/payments/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setToast('Payment deleted')
      loadKpis()
      loadFilterSummary()
      loadPayments(0, false)
    } else {
      const j = await res.json()
      setToast(j.error ?? 'Could not delete')
    }
  }

  const filterFieldsProps = {
    datePreset,
    setDatePreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    clientFilter,
    setClientFilter,
    methodFilter,
    setMethodFilter,
    clients,
  }

  const paymentCountLabel = filterSummary
    ? `${filterSummary.totalPayments} payment${filterSummary.totalPayments === 1 ? '' : 's'}`
    : `${rows.length} loaded`

  return (
    <main className="flex min-h-0 min-h-screen flex-1 flex-col space-y-6">
      <PageHeader title="Payments" countLabel={paymentCountLabel}>
        <Button type="button" className="min-h-[44px]" onClick={() => { setEditing(null); setModalOpen(true) }}>
          Record payment
        </Button>
      </PageHeader>

      <Card
        variant="default"
        padding="default"
        className="border border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--accent-light)_0%,transparent_55%)] p-6 shadow-[var(--shadow-sm)]"
      >
        <p className="text-[12px] font-medium text-[var(--text-tertiary)]">This month</p>
        <p className="mt-1 text-[40px] font-bold leading-none tracking-[-0.03em] text-[var(--accent)]">
          {formatCents(kpiMonth)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--text-tertiary)]">
          <span>{paymentCountLabel}</span>
          <span aria-hidden className="text-[var(--text-quaternary)]">
            ·
          </span>
          <span>Pending invoices {formatCents(pendingCents)}</span>
          <span aria-hidden className="text-[var(--text-quaternary)]">
            ·
          </span>
          <span>All-time recorded {formatCents(kpiAll)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card variant="raised" padding="lg" className="border border-[var(--border-default)] shadow-[var(--shadow-xs)]">
          <p className="text-[13px] text-[var(--text-tertiary)]">This week</p>
          <p className="mt-1 text-[20px] font-semibold text-[var(--text-primary)]">{formatCents(kpiWeek)}</p>
        </Card>
        <Card variant="raised" padding="lg" className="border border-[var(--border-default)] shadow-[var(--shadow-xs)]">
          <p className="text-[13px] text-[var(--text-tertiary)]">Total all time</p>
          <p className="mt-1 text-[20px] font-semibold text-[var(--text-primary)]">{formatCents(kpiAll)}</p>
        </Card>
        <Link href="/coach/invoices" className="block h-full min-h-[44px] hover:opacity-95 md:col-span-1">
          <Card variant="raised" padding="lg" className="h-full border border-[var(--border-default)] shadow-[var(--shadow-xs)]">
            <p className="text-[13px] text-[var(--text-tertiary)]">Pending invoices</p>
            <p className="mt-1 text-[20px] font-semibold text-[var(--accent)]">{formatCents(pendingCents)}</p>
          </Card>
        </Link>
      </div>

      {filterSummary && methodSegments.length > 0 && (
        <Card variant="raised" padding="lg">
          <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-ink)]">
            Payment methods (filtered)
          </h2>
          <div className="flex h-10 w-full overflow-hidden rounded-lg border border-[var(--color-border)]">
            {methodSegments.map(([m, cents]) => {
              const pct = methodTotal > 0 ? Math.round((cents / methodTotal) * 100) : 0
              const mv = m as PaymentMethodValue
              return (
                <div
                  key={m}
                  style={{ width: `${pct}%` }}
                  className={`flex min-w-0 items-center justify-center px-1 text-[11px] font-medium text-[var(--color-ink)] ${PAYMENT_METHOD_STYLES[mv] ?? 'bg-neutral-200'}`}
                  title={`${PAYMENT_METHOD_LABELS[mv] ?? m}: ${pct}%`}
                >
                  {pct >= 12 ? `${PAYMENT_METHOD_LABELS[mv] ?? m} ${pct}%` : ''}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[13px] text-[var(--color-muted)]">
            {methodSegments.map(([m, cents]) => {
              const pct = methodTotal > 0 ? Math.round((cents / methodTotal) * 100) : 0
              const mv = m as PaymentMethodValue
              return (
                <span key={m}>
                  {PAYMENT_METHOD_LABELS[mv] ?? m} {pct}%
                </span>
              )
            })}
          </div>
        </Card>
      )}

      <Card variant="raised" padding="lg">
        <div className="md:hidden">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] w-full"
            onClick={() => setFilterSheetOpen(true)}
          >
            Filters
          </Button>
        </div>
        <div className="hidden md:block">
          <PaymentsFilterFields {...filterFieldsProps} />
        </div>

        <Modal
          isOpen={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          title="Filters"
          className="w-full max-w-none md:max-w-md"
        >
          <PaymentsFilterFields {...filterFieldsProps} />
          <Button type="button" className="mt-6 min-h-[44px] w-full" onClick={() => setFilterSheetOpen(false)}>
            Done
          </Button>
        </Modal>

        {loading ? (
          <ul className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-border)]/40" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <p className="font-medium text-[var(--color-ink)]">No payments recorded yet.</p>
            <p className="mt-1 text-[15px] text-[var(--color-muted)]">
              Use the Record payment button to log your first payment.
            </p>
            <Button type="button" className="mt-4 min-h-[44px]" onClick={() => { setEditing(null); setModalOpen(true) }}>
              Record payment
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 hidden md:block">
              <DataTable
                rows={rows}
                loading={loading}
                emptyTitle="No payments recorded yet"
                emptyDescription="Use the Record payment button to log your first payment."
                columns={[
                  { key: 'client', header: 'Client', sortValue: (r) => clientName(r.clients), render: (p) => clientName(p.clients) },
                  { key: 'amount', header: 'Amount', sortValue: (r) => r.amount_cents, render: (p) => <span className="font-medium">{formatCents(p.amount_cents)}</span> },
                  {
                    key: 'method',
                    header: 'Method',
                    render: (p) => <span className="inline-flex items-center gap-2"><StatusDot tone="active" />{PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethodValue] ?? p.payment_method}</span>,
                  },
                  { key: 'date', header: 'Date', sortValue: (r) => r.payment_date, render: (p) => p.payment_date },
                  { key: 'reference', header: 'Reference', render: (p) => p.payment_reference ?? '—' },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (p) => (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="xs" onClick={() => openEdit(p)}>Edit</Button>
                        <Button variant="destructive-secondary" size="xs" onClick={() => handleDelete(p)}>Delete</Button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>

            <ul className="mt-6 md:hidden space-y-3">
              {rows.map((p) => (
                <li key={p.id} className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{clientName(p.clients)}</span>
                    <span className="font-medium">{formatCents(p.amount_cents)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${
                        PAYMENT_METHOD_STYLES[p.payment_method as PaymentMethodValue] ?? 'bg-neutral-200'
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethodValue] ?? p.payment_method}
                    </span>
                    <span className="text-[13px] text-[var(--color-muted)]">{p.payment_date}</span>
                  </div>
                  {p.payment_reference ? (
                    <p className="mt-1 text-[13px] text-[var(--color-muted)]">Ref: {p.payment_reference}</p>
                  ) : null}
                  {p.notes ? <p className="mt-1 text-[13px] text-[var(--color-muted)]">{p.notes}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" type="button" className="min-h-[44px] flex-1" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    <Button variant="destructive-secondary" type="button" className="min-h-[44px] flex-1" onClick={() => handleDelete(p)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[44px]"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true)
                    loadPayments(offset, true).finally(() => setLoadingMore(false))
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <RecordPaymentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editingPayment={editing}
        onRecorded={({ clientName: cn, amountCents }) => {
          setToast(`Payment of ${formatCents(amountCents)} recorded from ${cn}`)
          loadKpis()
          loadFilterSummary()
          loadPayments(0, false)
        }}
        onUpdated={() => {
          setToast('Payment updated')
          loadKpis()
          loadFilterSummary()
          loadPayments(0, false)
        }}
      />

      {toast && (
        <div
          className="safe-bottom fixed bottom-20 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[15px] text-[var(--color-ink)] shadow-sm lg:bottom-8"
          role="status"
        >
          {toast}
        </div>
      )}
    </main>
  )
}
