'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { StatusDot } from '@/components/ui/StatusDot'

type ClientRow = { id: string; first_name: string | null; last_name: string | null; email: string | null }
type PackageRow = { id: string; title: string | null; description: string | null }
type InvoiceRow = {
  id: string
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

export function InvoicesPageContent() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [clients, setClients] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([])

  const fetchInvoices = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
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
  }, [statusFilter, clientFilter])

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
  const totalReceived = paid.reduce((s, i) => s + i.amount_cents, 0)
  const totalPending = pending.reduce((s, i) => s + i.amount_cents, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" contextInfo={`${pending.length} pending · ${paid.length} paid`}>
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
            <p className="text-sm font-medium text-[var(--color-muted)]">Total received</p>
            <p className="mt-1 text-2xl font-medium text-[var(--color-ink)]">
              {formatAmount(totalReceived, 'usd')}
            </p>
          </Card>
          <Card variant="raised" padding="lg">
            <p className="text-sm font-medium text-[var(--color-muted)]">Pending</p>
            <p className="mt-1 text-2xl font-medium text-[var(--color-ink)]">
              {formatAmount(totalPending, 'usd')}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-[15px] min-h-[44px]"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-[15px] min-h-[44px]"
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
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="h-6 w-1/3 rounded bg-[var(--color-border)] animate-pulse" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded bg-[var(--color-border)] animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <p className="text-[var(--color-muted)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchInvoices}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[36px]">💰</div>
          <p className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">No invoices yet</p>
          <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-[1.6] text-[var(--text-tertiary)]">Send an invoice from a session package to see it here.</p>
          <Link href="/coach/packages">
            <Button className="mt-4">Go to packages</Button>
          </Link>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <DataTable
          rows={invoices}
          loading={loading}
          emptyTitle="No invoices yet"
          emptyDescription="Send an invoice from a session package to see it here."
          columns={[
            { key: 'client', header: 'Client', sortValue: (r) => clientName(r.clients), render: (inv) => clientName(inv.clients) },
            { key: 'package', header: 'Package', render: (inv) => <span className="text-[var(--text-tertiary)]">{inv.session_packages?.title ?? '—'}</span> },
            { key: 'amount', header: 'Amount', sortValue: (r) => r.amount_cents, render: (inv) => formatAmount(inv.amount_cents, inv.currency) },
            {
              key: 'status',
              header: 'Status',
              sortValue: (r) => r.status,
              render: (inv) => <span className="inline-flex items-center gap-2 text-[13px]"><StatusDot tone={inv.status === 'paid' ? 'active' : inv.status === 'pending' ? 'pending' : 'inactive'} />{inv.status}</span>,
            },
            { key: 'method', header: 'Method', render: (inv) => inv.payment_method ? PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method : '—' },
            { key: 'date', header: 'Date', sortValue: (r) => r.created_at, render: (inv) => formatDate(inv.created_at) },
            { key: 'actions', header: 'Actions', render: () => <Button size="xs" variant="ghost">Open</Button> },
          ]}
        />
      )}
    </div>
  )
}
