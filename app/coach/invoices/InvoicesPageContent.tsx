'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { differenceInCalendarDays } from 'date-fns'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { StatusDot } from '@/components/ui/StatusDot'
import { MarkPaidModal } from '@/components/coach/MarkPaidModal'
import { cn } from '@/lib/utils'

type InvoiceStatusTab = 'all' | 'pending' | 'paid' | 'closed'

type ClientRow = { id: string; first_name: string | null; last_name: string | null; email: string | null }
type PackageRow = { id: string; title: string | null; description: string | null }
type InvoiceRow = {
  id: string
  client_id: string
  message_id: string | null
  amount_cents: number
  currency: string
  status: string
  payment_method: string | null
  payment_method_note: string | null
  payment_reference: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
  session_packages: PackageRow | null
  clients: ClientRow | null
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  zelle: 'Zelle',
  venmo: 'Venmo',
  cashapp: 'CashApp',
  paypal: 'PayPal',
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  other: 'Other',
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function clientName(clients: ClientRow | null): string {
  if (!clients) return '—'
  const name = [clients.first_name, clients.last_name].filter(Boolean).join(' ')
  return name || clients.email || '—'
}

function exportToCsv(invoices: InvoiceRow[]) {
  const headers = ['Client', 'Package', 'Amount', 'Status', 'Payment method', 'Sent date', 'Paid date']
  const rows = invoices.map((inv) => [
    clientName(inv.clients),
    inv.session_packages?.title ?? '—',
    formatAmount(inv.amount_cents, inv.currency),
    inv.status,
    inv.payment_method ? PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method : '—',
    formatDate(inv.created_at),
    formatDate(inv.paid_at),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function pendingOverdueDays(createdAt: string): number {
  return differenceInCalendarDays(new Date(), new Date(createdAt))
}

export function InvoicesPageContent() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<InvoiceStatusTab>('all')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [clients, setClients] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([])
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceRow | null>(null)
  const [resendBusyId, setResendBusyId] = useState<string | null>(null)
  const [actionToast, setActionToast] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (clientFilter) params.set('clientId', clientFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load invoices')
        setInvoices([])
        return
      }
      setInvoices(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [clientFilter])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      const json = await res.json()
      if (res.ok) setClients(json.data ?? [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const paid = invoices.filter((i) => i.status === 'paid')
  const pending = invoices.filter((i) => i.status === 'pending')
  const closed = invoices.filter((i) => i.status === 'cancelled' || i.status === 'refunded')
  const totalReceived = paid.reduce((s, i) => s + i.amount_cents, 0)
  const totalPending = pending.reduce((s, i) => s + i.amount_cents, 0)

  const displayedInvoices = useMemo(() => {
    if (statusTab === 'all') return invoices
    if (statusTab === 'pending') return invoices.filter((i) => i.status === 'pending')
    if (statusTab === 'paid') return invoices.filter((i) => i.status === 'paid')
    return invoices.filter((i) => i.status === 'cancelled' || i.status === 'refunded')
  }, [invoices, statusTab])

  const statusTabs: { key: InvoiceStatusTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: invoices.length },
    { key: 'pending', label: 'Pending', count: pending.length },
    { key: 'paid', label: 'Paid', count: paid.length },
    { key: 'closed', label: 'Closed', count: closed.length },
  ]

  const openInvoiceThread = useCallback(
    (inv: InvoiceRow) => {
      const q = new URLSearchParams({ clientId: inv.client_id })
      if (inv.message_id) q.set('messageId', inv.message_id)
      router.push(`/coach/messages?${q.toString()}`)
    },
    [router]
  )

  const resendInvoice = useCallback(
    async (inv: InvoiceRow) => {
      setResendBusyId(inv.id)
      setActionToast(null)
      setActionError(null)
      try {
        const res = await fetch(`/api/invoices/${encodeURIComponent(inv.id)}/resend`, {
          method: 'POST',
          credentials: 'include',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setActionError(typeof json.error === 'string' ? json.error : 'Could not resend invoice')
          return
        }
        setActionToast('Invoice sent again in the message thread')
        setTimeout(() => setActionToast(null), 4000)
      } catch {
        setActionError('Could not resend invoice — try again')
      } finally {
        setResendBusyId(null)
      }
    },
    []
  )

  const invoiceColumns = useMemo(
    () => [
      { key: 'client', header: 'Client', sortValue: (r: InvoiceRow) => clientName(r.clients), render: (inv: InvoiceRow) => clientName(inv.clients) },
      {
        key: 'package',
        header: 'Package',
        render: (inv: InvoiceRow) => <span className="text-[var(--text-tertiary)]">{inv.session_packages?.title ?? '—'}</span>,
      },
      {
        key: 'amount',
        header: 'Amount',
        sortValue: (r: InvoiceRow) => r.amount_cents,
        render: (inv: InvoiceRow) => (
          <span
            className={cn(
              'tabular-nums',
              inv.status === 'pending'
                ? 'text-[16px] font-bold text-[var(--warning)]'
                : 'text-[var(--text-primary)]'
            )}
          >
            {formatAmount(inv.amount_cents, inv.currency)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortValue: (r: InvoiceRow) => r.status,
        render: (inv: InvoiceRow) => (
          <span className="inline-flex items-center gap-2 text-[13px]">
            <StatusDot tone={inv.status === 'paid' ? 'active' : inv.status === 'pending' ? 'pending' : 'inactive'} />
            {inv.status}
          </span>
        ),
      },
      {
        key: 'method',
        header: 'Method',
        render: (inv: InvoiceRow) =>
          inv.payment_method ? PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method : '—',
      },
      {
        key: 'date',
        header: 'Date',
        sortValue: (r: InvoiceRow) => r.created_at,
        render: (inv: InvoiceRow) => {
          if (inv.status === 'pending' && pendingOverdueDays(inv.created_at) > 7) {
            const n = pendingOverdueDays(inv.created_at)
            return (
              <span className="inline-flex rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-[12px] font-semibold text-[var(--error)]">
                ⚠ {n} days overdue
              </span>
            )
          }
          return formatDate(inv.created_at)
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (inv: InvoiceRow) => (
          <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="xs" variant="ghost" type="button" onClick={() => openInvoiceThread(inv)}>
              Open
            </Button>
            {inv.status === 'pending' ? (
              <>
                <Button size="xs" variant="primary" type="button" onClick={() => setMarkPaidInvoice(inv)}>
                  Mark paid
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  type="button"
                  disabled={resendBusyId === inv.id}
                  onClick={() => void resendInvoice(inv)}
                >
                  {resendBusyId === inv.id ? 'Sending…' : 'Resend'}
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [openInvoiceThread, resendBusyId, resendInvoice]
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" icon={<Icon name="invoices" />} countLabel={`${pending.length} pending · ${paid.length} paid`}>
        <div className="flex flex-wrap gap-2">
          <Link href="/coach/packages">
            <Button variant="secondary" size="sm">Packages</Button>
          </Link>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportToCsv(invoices)}
            disabled={invoices.length === 0}
          >
            Export to CSV
          </Button>
        </div>
      </PageHeader>

      {!loading && !error && invoices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card variant="raised" padding="lg">
            <p className="text-[13px] font-medium text-[var(--text-tertiary)]">Total received</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {formatAmount(totalReceived, 'usd')}
            </p>
          </Card>
          <Card variant="raised" padding="lg">
            <p className="text-[13px] font-medium text-[var(--text-tertiary)]">Pending</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {formatAmount(totalPending, 'usd')}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Invoice status">
          {statusTabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={statusTab === key}
              onClick={() => setStatusTab(key)}
              className={cn(
                'h-9 min-h-9 rounded-[var(--radius-md)] px-3 text-[12px] font-medium transition-colors duration-[80ms]',
                statusTab === key
                  ? 'bg-[var(--cp-offwhite)] text-[var(--cp-accent)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]'
              )}
            >
              {label}
              <span className="ml-1 tabular-nums text-[var(--text-quaternary)]">({count})</span>
            </button>
          ))}
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 min-h-9 w-full max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--cp-accent)] focus:shadow-[var(--focus-ring)] sm:w-auto"
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.id}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6">
          <div className="h-6 w-1/3 max-w-[200px] animate-pulse rounded bg-[var(--border-default)]" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-[var(--border-default)]" />
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6 text-center">
          <p className="text-[14px] text-[var(--text-secondary)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchInvoices}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="empty-state-coach rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <div className="empty-state-coach__icon flex size-20 items-center justify-center text-[36px]">💰</div>
          <p className="empty-state-coach__title mt-4">No invoices yet</p>
          <p className="empty-state-coach__desc mx-auto mt-2 max-w-[320px]">
            Send an invoice from a session package to see it here.
          </p>
          <Link href="/coach/packages" className="empty-state-coach__cta inline-block">
            <Button>Go to packages</Button>
          </Link>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && displayedInvoices.length === 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-6 py-10 text-center">
          <p className="text-[15px] font-medium text-[var(--text-primary)]">No invoices in this view</p>
          <p className="mx-auto mt-2 max-w-[360px] text-[14px] text-[var(--text-tertiary)]">
            Try another status tab or clear the client filter.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setStatusTab('all'); setClientFilter('') }}>
            Show all
          </Button>
        </div>
      )}

      {!loading && !error && displayedInvoices.length > 0 && (
        <DataTable
          rows={displayedInvoices}
          loading={loading}
          emptyTitle="No invoices yet"
          emptyDescription="Send an invoice from a session package to see it here."
          rowClassName={(inv) =>
            inv.status === 'pending'
              ? 'border-l-[3px] border-l-[var(--warning)] bg-[var(--warning-bg)] hover:bg-[var(--warning-bg)]'
              : ''
          }
          columns={invoiceColumns}
        />
      )}

      {markPaidInvoice ? (
        <MarkPaidModal
          isOpen
          onClose={() => setMarkPaidInvoice(null)}
          invoiceId={markPaidInvoice.id}
          clientName={clientName(markPaidInvoice.clients)}
          amountCents={markPaidInvoice.amount_cents}
          currency={markPaidInvoice.currency}
          onSuccess={() => {
            setMarkPaidInvoice(null)
            void fetchInvoices()
          }}
        />
      ) : null}

      {actionToast ? (
        <div role="status" aria-live="polite" className="toast-coach flex items-center gap-2">
          <span className="text-[var(--success)]" aria-hidden>
            ✓
          </span>
          {actionToast}
        </div>
      ) : null}

      {actionError ? (
        <div role="alert" className="toast-coach flex items-center gap-2 border border-[var(--error)] bg-[var(--error-bg)] text-[var(--error)]">
          {actionError}
        </div>
      ) : null}
    </div>
  )
}
