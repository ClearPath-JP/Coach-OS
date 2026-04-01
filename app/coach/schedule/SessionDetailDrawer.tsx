'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'
import { RecordPaymentModal } from '@/components/coach/RecordPaymentModal'
import { MarkPaidModal } from '@/components/coach/MarkPaidModal'

export type SessionForDrawer = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  notes: string | null
  client_id: string
  clients: { first_name: string | null; last_name: string | null } | null
}

export interface SessionDetailDrawerProps {
  session: SessionForDrawer | null
  onClose: () => void
  onUpdated: () => void
  onToast?: (message: string, variant?: 'success' | 'error' | 'warning') => void
  /** Opens book flow with this session’s client and duration; old session is removed after a new time is booked. */
  onReschedule?: () => void
}

export function SessionDetailDrawer({ session, onClose, onUpdated, onToast, onReschedule }: SessionDetailDrawerProps) {
  const [notes, setNotes] = useState(session?.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [paymentState, setPaymentState] = useState<'none' | 'invoice_pending' | 'paid'>('none')
  const [paymentAmountCents, setPaymentAmountCents] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)
  const [paymentDate, setPaymentDate] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [markPaidOpen, setMarkPaidOpen] = useState(false)

  useEffect(() => {
    if (!session) return
    setNotes(session.notes ?? '')
    setConfirmCancel(false)
    setConfirmRemove(false)
  }, [session])

  useEffect(() => {
    if (!session) return
    fetch(`/api/payments?clientId=${encodeURIComponent(session.client_id)}`)
      .then((res) => res.json())
      .then((json) => {
        const payment = (json.data ?? []).find((p: { session_id?: string | null; amount_cents?: number; payment_method?: string | null; payment_date?: string | null }) => p.session_id === session.id)
        if (payment) {
          setPaymentState('paid')
          setPaymentAmountCents(payment.amount_cents ?? null)
          setPaymentMethod(payment.payment_method ?? null)
          setPaymentDate(payment.payment_date ?? null)
          return
        }
        return fetch(`/api/invoices?clientId=${encodeURIComponent(session.client_id)}&status=pending`)
          .then((r) => r.json())
          .then((invJson) => {
            const inv = (invJson.data ?? [])[0]
            if (inv) {
              setPaymentState('invoice_pending')
              setInvoiceId(inv.id ?? null)
              setPaymentAmountCents(inv.amount_cents ?? null)
              setPaymentDate(inv.created_at ?? null)
            } else {
              setPaymentState('none')
            }
          })
      })
      .catch(() => {
        setPaymentState('none')
      })
  }, [session])

  if (!session) return null

  const clientName = [session.clients?.first_name, session.clients?.last_name].filter(Boolean).join(' ') || 'Client'
  const start = new Date(session.scheduled_time)
  const end = session.end_time ? new Date(session.end_time) : session.duration_minutes ? new Date(start.getTime() + session.duration_minutes * 60 * 1000) : new Date(start.getTime() + 60 * 60 * 1000)
  const durationMins = session.duration_minutes ?? Math.round((end.getTime() - start.getTime()) / 60000)

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (res.ok) {
        onUpdated()
      } else {
        onToast?.("Couldn't save notes", 'error')
      }
    } finally {
      setSavingNotes(false)
    }
  }

  const markComplete = async () => {
    const answer = window.prompt('Was payment received for this session?\nType: yes, already, or no')
    if (answer == null) return
    const normalized = answer.trim().toLowerCase()
    if (normalized === 'yes') {
      setRecordPaymentOpen(true)
      return
    }
    if (normalized !== 'already' && normalized !== 'no') {
      onToast?.('Please answer yes, already, or no', 'warning')
      return
    }
    setActionLoading(true)
    try {
      const payload: Record<string, unknown> = { status: 'completed' }
      if (normalized === 'no') payload.paid = false
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onUpdated()
        onToast?.('Session marked complete', 'success')
      } else {
        onToast?.("Couldn't update session", 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const cancelSession = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (res.ok) {
        onUpdated()
        onToast?.('Session cancelled', 'success')
        setConfirmCancel(false)
      } else {
        onToast?.("Couldn't cancel session", 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const removeFromCalendar = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
      if (res.ok) {
        onUpdated()
        onToast?.('Session removed from calendar', 'success')
        setConfirmRemove(false)
        onClose()
      } else {
        const json = await res.json().catch(() => ({}))
        onToast?.(typeof json.error === 'string' ? json.error : "Couldn't remove session", 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const sendReminder = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/send-reminder`, { method: 'POST' })
      if (res.ok) {
        onToast?.('Reminder sent', 'success')
      } else {
        onToast?.("Couldn't send reminder", 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const statusVariant = session.status === 'confirmed' ? 'active' : session.status === 'completed' ? 'inactive' : 'pending'

  return (
    <div className="h-full border-l border-[var(--color-border)] bg-[var(--color-bg)] shadow-sm flex flex-col" role="dialog" aria-modal="false">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Session details</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Client</p>
          <Link href={`/coach/clients/${session.client_id}`} className="text-[var(--color-accent)] hover:underline font-medium">
            {clientName}
          </Link>
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Date & time</p>
          <p className="text-sm text-[var(--color-text-primary)]">{format(start, 'EEEE, MMM d, yyyy')} · {format(start, 'h:mm a')} – {format(end, 'h:mm a')}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{durationMins} min</p>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            To move this session, use Reschedule to pick a new date and time. The previous time is removed after the new session is booked.
          </p>
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Status</p>
          <Badge variant={statusVariant}>{session.status}</Badge>
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Type</p>
          <p className="text-[var(--color-text-primary)]">video</p>
        </div>
        <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Payment</p>
          {paymentState === 'none' ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)]">No payment recorded</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="text-xs" onClick={() => setMarkPaidOpen(true)}>Send invoice</Button>
                <Button variant="secondary" className="text-xs" onClick={() => setRecordPaymentOpen(true)}>Record payment</Button>
              </div>
            </div>
          ) : null}
          {paymentState === 'invoice_pending' ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-primary)]">Invoice sent — pending payment</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {(paymentAmountCents != null ? `$${(paymentAmountCents / 100).toFixed(2)}` : 'Amount pending')}
                {paymentDate ? ` · sent ${format(new Date(paymentDate), 'MMM d, yyyy')}` : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="text-xs" onClick={() => setMarkPaidOpen(true)}>Resend invoice</Button>
                <Button variant="secondary" className="text-xs" onClick={() => setMarkPaidOpen(true)}>Mark as paid</Button>
              </div>
            </div>
          ) : null}
          {paymentState === 'paid' ? (
            <div className="space-y-2">
              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Paid</span>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {(paymentAmountCents != null ? `$${(paymentAmountCents / 100).toFixed(2)}` : 'Paid')}
                {paymentMethod ? ` · ${paymentMethod}` : ''}
                {paymentDate ? ` · ${format(new Date(paymentDate), 'MMM d, yyyy')}` : ''}
              </p>
              <Link href="/coach/payments" className="text-xs font-medium text-[var(--color-accent)] hover:underline">
                View payment
              </Link>
            </div>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            disabled={savingNotes}
            rows={3}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
            placeholder="Session notes…"
          />
        </div>
        <div className="flex flex-col gap-2 pt-4 border-t border-[var(--color-border)]">
          {onReschedule && session.status !== 'completed' ? (
            <Button type="button" variant="secondary" disabled={actionLoading} onClick={() => onReschedule()}>
              Reschedule
            </Button>
          ) : null}
          <Button onClick={markComplete} disabled={actionLoading} variant="secondary" className="border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success-light)]">
            Mark complete
          </Button>
          {!confirmCancel ? (
            <Button variant="destructive-secondary" onClick={() => setConfirmCancel(true)} disabled={actionLoading}>
              Cancel session
            </Button>
          ) : (
            <div className="rounded-lg bg-[var(--color-error-light)] p-3">
              <p className="text-sm text-[var(--color-error)] mb-2">Cancel this session?</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={cancelSession} disabled={actionLoading}>
                  Cancel session
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                  Keep
                </Button>
              </div>
            </div>
          )}
          {session.status !== 'completed' ? (
            !confirmRemove ? (
              <Button variant="destructive-secondary" onClick={() => setConfirmRemove(true)} disabled={actionLoading}>
                Remove from calendar
              </Button>
            ) : (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <p className="text-sm text-[var(--color-text-primary)] mb-2">
                  Remove this booking for {clientName}? This deletes the session and cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" onClick={removeFromCalendar} disabled={actionLoading}>
                    Remove
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmRemove(false)}>
                    Keep
                  </Button>
                </div>
              </div>
            )
          ) : null}
          <Button variant="secondary" onClick={sendReminder} disabled={actionLoading}>
            Send reminder
          </Button>
        </div>
      </div>
      <RecordPaymentModal
        open={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        defaultClientId={session.client_id}
        onRecorded={() => {
          setRecordPaymentOpen(false)
          onUpdated()
          onToast?.('Payment recorded', 'success')
        }}
      />
      {invoiceId ? (
        <MarkPaidModal
          isOpen={markPaidOpen}
          onClose={() => setMarkPaidOpen(false)}
          invoiceId={invoiceId}
          clientName={clientName}
          amountCents={paymentAmountCents ?? 0}
          currency="usd"
          onSuccess={() => {
            setMarkPaidOpen(false)
            onUpdated()
            onToast?.('Invoice marked paid', 'success')
          }}
        />
      ) : null}
    </div>
  )
}
