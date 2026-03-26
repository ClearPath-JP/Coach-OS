'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Input'
import { differenceInDays } from 'date-fns'
import { AssignProgramToClientModal } from '@/components/coach/AssignProgramToClientModal'
import { RecordPaymentModal } from '@/components/coach/RecordPaymentModal'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_STYLES,
  type PaymentMethodValue,
} from '@/lib/payment-methods'
import { formatCents } from '@/lib/format-currency'

type ClientPaymentRow = {
  id: string
  amount_cents: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
}

type Client = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  goals: string | null
  status: string
  notes: string | null
  profile_photo_url: string | null
  created_at: string
  updated_at: string
}

function statusBadgeVariant(s: string): 'active' | 'inactive' | 'pending' {
  if (s === 'active') return 'active'
  if (s === 'paused') return 'pending'
  return 'inactive'
}

export function ClientDetailContent({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [clientPrograms, setClientPrograms] = useState<{ programId: string; title: string; status: string; totalModules: number; modulesCompleted: number; assignedAt: string }[]>([])
  const [assignProgramOpen, setAssignProgramOpen] = useState(false)
  const [tab, setTab] = useState<'overview' | 'payments'>('overview')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentsTotal, setPaymentsTotal] = useState<number | null>(null)
  const [paymentRows, setPaymentRows] = useState<ClientPaymentRow[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  const loadPaymentsTab = useCallback(async () => {
    setPaymentsLoading(true)
    try {
      const [sumRes, listRes] = await Promise.all([
        fetch(`/api/payments/summary?period=all&clientId=${encodeURIComponent(clientId)}`),
        fetch(`/api/payments?clientId=${encodeURIComponent(clientId)}`),
      ])
      const sumJson = await sumRes.json()
      const listJson = await listRes.json()
      if (sumJson.data) setPaymentsTotal(sumJson.data.totalRevenue ?? 0)
      if (Array.isArray(listJson.data)) setPaymentRows(listJson.data)
    } catch {
      setPaymentsTotal(null)
      setPaymentRows([])
    } finally {
      setPaymentsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (tab === 'payments') loadPaymentsTab()
  }, [tab, loadPaymentsTab])

  const fetchClient = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "We couldn't find that client")
        setClient(null)
        return
      }
      setClient(json.data)
      setNotes(json.data.notes ?? '')
      const progRes = await fetch(`/api/clients/${clientId}/programs`)
      const progJson = await progRes.json()
      if (progRes.ok && progJson.data) setClientPrograms(progJson.data)
    } catch {
      setError('Something went wrong — check your connection and try again')
      setClient(null)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const updateStatus = async (newStatus: 'active' | 'paused' | 'completed') => {
    if (!client || client.status === newStatus) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setClient((prev) => (prev ? { ...prev, status: json.data.status } : null))
      }
    } finally {
      setStatusUpdating(false)
    }
  }

  const sendInvite = async () => {
    if (!client?.email || inviteSent || inviteSending) return
    setInviteSending(true)
    setToast(null)
    try {
      const res = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: client.email }),
      })
      const json = await res.json()
      if (res.ok) {
        setToast(`Invite sent to ${client.email}`)
        setInviteSent(true)
      } else {
        setToast(json.error ?? 'Could not send invite')
        if (json.error?.toLowerCase().includes('already has an account')) {
          setInviteSent(true)
        }
      }
    } catch {
      setToast('Something went wrong — try again')
    } finally {
      setInviteSending(false)
    }
  }

  const saveNotes = async () => {
    if (!client) return
    setNotesSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setClient((prev) => (prev ? { ...prev, notes: json.data.notes } : null))
      }
    } finally {
      setNotesSaving(false)
    }
  }

  const fullName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'
    : ''

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-32 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--color-border)]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card className="h-48 animate-pulse" />
            <Card className="h-32 animate-pulse" />
          </div>
          <div className="space-y-4">
            <Card className="h-24 animate-pulse" />
            <Card className="h-40 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Link
          href="/coach/clients"
          className="inline-flex items-center gap-1 text-[15px] text-[var(--color-accent)] hover:underline"
        >
          ← Back to Clients
        </Link>
        <Card className="rounded-xl border border-[var(--color-border)] p-8 text-center">
          <p className="text-[var(--color-text-primary)]">
            {error ?? "We couldn't find that client — it may have been deleted."}
          </p>
          <Link href="/coach/clients">
            <Button variant="secondary" className="mt-4">
              Back to clients
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  const daysAsClient = differenceInDays(new Date(), new Date(client.created_at))
  const statusOptions: ('active' | 'paused' | 'completed')[] = ['active', 'paused', 'completed']

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/coach/clients"
          className="inline-flex items-center gap-1 text-[15px] text-[var(--color-accent)] hover:underline"
        >
          ← Back to Clients
        </Link>
      </div>

      <PageHeader title={fullName}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(client.status)}>{client.status}</Badge>
          {tab === 'payments' && (
            <Button type="button" className="min-h-[44px]" onClick={() => setPaymentModalOpen(true)}>
              Record payment
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2" role="tablist" aria-label="Client sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          onClick={() => setTab('overview')}
          className={`rounded-full px-4 py-2 text-[14px] font-medium min-h-[44px] ${
            tab === 'overview'
              ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'payments'}
          onClick={() => setTab('payments')}
          className={`rounded-full px-4 py-2 text-[14px] font-medium min-h-[44px] ${
            tab === 'payments'
              ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
          }`}
        >
          Payments
        </button>
      </div>

      {tab === 'payments' && (
        <div className="space-y-4">
          <Card variant="raised" padding="lg">
            <p className="text-[14px] text-[var(--color-muted)]">Total received from this client</p>
            <p className="mt-1 text-xl font-medium text-[var(--color-ink)]">
              {paymentsLoading ? '…' : paymentsTotal === null ? '—' : formatCents(paymentsTotal)}
            </p>
          </Card>
          {paymentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-border)]/50" />
              ))}
            </div>
          ) : paymentRows.length === 0 ? (
            <Card variant="raised" padding="lg" className="text-center">
              <p className="text-[15px] text-[var(--color-ink)]">No payments recorded for this client yet.</p>
              <Button type="button" className="mt-4 min-h-[44px]" onClick={() => setPaymentModalOpen(true)}>
                Record payment
              </Button>
            </Card>
          ) : (
            <ul className="space-y-3">
              {paymentRows.map((p) => (
                <li key={p.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-medium text-[var(--color-ink)]">{formatCents(p.amount_cents)}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${
                        PAYMENT_METHOD_STYLES[p.payment_method as PaymentMethodValue] ?? 'bg-neutral-200'
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethodValue] ?? p.payment_method}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[var(--color-muted)]">{p.payment_date}</p>
                  {p.payment_reference ? (
                    <p className="mt-1 text-[14px] text-[var(--color-muted)]">Ref: {p.payment_reference}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'overview' && (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-4">
              Contact & details
            </h2>
            <dl className="grid gap-3 text-[15px]">
              <div>
                <dt className="text-[var(--color-text-secondary)]">Email</dt>
                <dd className="mt-0.5 text-[var(--color-text-primary)]">{client.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-secondary)]">Phone</dt>
                <dd className="mt-0.5 text-[var(--color-text-primary)]">{client.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-secondary)]">Goals</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-[var(--color-text-primary)]">
                  {client.goals || '—'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-4">
              Notes
            </h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Coach-only notes…"
              rows={4}
              disabled={notesSaving}
            />
            <Button
              variant="secondary"
              className="mt-3"
              onClick={saveNotes}
              disabled={notesSaving || notes === (client.notes ?? '')}
            >
              {notesSaving ? 'Saving…' : 'Save notes'}
            </Button>
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-4">
          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-3">
              Status
            </h2>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => updateStatus(s)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-[14px] font-medium capitalize transition-colors disabled:opacity-50 ${
                    client.status === s
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-3">
              Portal access
            </h2>
            {client.email ? (
              <>
                <Button
                  variant="secondary"
                  fullWidth
                  className="min-h-[44px]"
                  disabled={inviteSent || inviteSending}
                  onClick={sendInvite}
                >
                  {inviteSending ? 'Sending…' : inviteSent ? 'Invite sent' : 'Send invite'}
                </Button>
                {toast && (
                  <p className={`mt-2 text-[14px] ${inviteSent ? 'text-[var(--color-muted)]' : 'text-[var(--color-error)]'}`}>
                    {toast}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[14px] text-[var(--color-muted)]">
                Add an email to send a portal invite.
              </p>
            )}
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-3">
              Quick stats
            </h2>
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)]">Days as client</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">{daysAsClient}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)]">Programs</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">{clientPrograms.length}</dd>
              </div>
            </dl>
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-3">
              Programs
            </h2>
            {clientPrograms.length === 0 ? (
              <p className="text-[14px] text-[var(--color-muted)] mb-3">
                No programs assigned yet.
              </p>
            ) : (
              <ul className="space-y-3 mb-3">
                {clientPrograms.map((cp) => {
                  const pct = cp.totalModules > 0 ? Math.round((cp.modulesCompleted / cp.totalModules) * 100) : 0
                  return (
                    <li key={cp.programId}>
                      <Link
                        href={`/coach/programs/${cp.programId}`}
                        className="block rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface)]"
                      >
                        <span className="font-medium text-[var(--color-ink)]">{cp.title}</span>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--color-accent)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {cp.modulesCompleted} of {cp.totalModules} modules
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <Button
              variant="secondary"
              fullWidth
              className="min-h-[44px]"
              onClick={() => setAssignProgramOpen(true)}
            >
              Assign program
            </Button>
          </Card>
        </div>
      </div>
      )}

      <AssignProgramToClientModal
        clientId={clientId}
        clientName={fullName}
        open={assignProgramOpen}
        onClose={() => setAssignProgramOpen(false)}
        onAssigned={() => {
          fetch(`/api/clients/${clientId}/programs`)
            .then((r) => r.json())
            .then((json) => json.data && setClientPrograms(json.data))
        }}
      />

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        defaultClientId={clientId}
        onRecorded={() => loadPaymentsTab()}
      />
    </div>
  )
}
