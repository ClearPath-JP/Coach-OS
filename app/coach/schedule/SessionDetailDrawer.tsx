'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format, formatDistanceToNow } from 'date-fns'
import { RecordPaymentModal } from '@/components/coach/RecordPaymentModal'
import { MarkPaidModal } from '@/components/coach/MarkPaidModal'
import { parseActionItemsJson } from '@/lib/sessions/action-items'
import { cn } from '@/lib/utils'

export type SessionForDrawer = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  notes: string | null
  client_id: string
  coach_private_notes?: string | null
  session_summary?: string | null
  action_items?: unknown
  notes_sent_at?: string | null
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

type DraftAction = { id: string; text: string; assignedTo: 'client' | 'coach' }

export function SessionDetailDrawer({ session, onClose, onUpdated, onToast, onReschedule }: SessionDetailDrawerProps) {
  const [notesTab, setNotesTab] = useState<'client' | 'private'>('client')
  const [sessionSummary, setSessionSummary] = useState('')
  const [coachPrivateNotes, setCoachPrivateNotes] = useState('')
  const [actionDraft, setActionDraft] = useState<DraftAction[]>([])
  const [newActionText, setNewActionText] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSending, setNotesSending] = useState(false)
  const [notesSentAt, setNotesSentAt] = useState<string | null>(null)
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
    setSessionSummary(session.session_summary ?? '')
    setCoachPrivateNotes(session.coach_private_notes ?? '')
    const parsed = parseActionItemsJson(session.action_items)
    setActionDraft(
      parsed.map((r) => ({
        id: r.id,
        text: r.text,
        assignedTo: r.assigned_to,
      }))
    )
    setNotesSentAt(session.notes_sent_at ?? null)
    setNewActionText('')
    setNotesTab('client')
    setConfirmCancel(false)
    setConfirmRemove(false)
  }, [session])

  useEffect(() => {
    if (!session?.id) return
    let cancelled = false
    void fetch(`/api/sessions/${session.id}/notes`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return null
        return (await r.json()) as {
          data?: {
            session?: {
              session_summary?: string | null
              coach_private_notes?: string | null
              action_items?: unknown
              notes_sent_at?: string | null
            }
          }
        }
      })
      .then((json) => {
        if (cancelled || !json?.data?.session) return
        const s = json.data.session
        setSessionSummary(s.session_summary ?? '')
        setCoachPrivateNotes(s.coach_private_notes ?? '')
        setNotesSentAt(s.notes_sent_at ?? null)
        const parsed = parseActionItemsJson(s.action_items)
        setActionDraft(
          parsed.map((r) => ({
            id: r.id,
            text: r.text,
            assignedTo: r.assigned_to,
          }))
        )
      })
    return () => {
      cancelled = true
    }
  }, [session?.id])

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

  const saveStructuredNotes = async (opts: { sendToClient: boolean }) => {
    if (opts.sendToClient) setNotesSending(true)
    else setNotesSaving(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionSummary: sessionSummary.trim() || undefined,
          actionItems: actionDraft,
          sendToClient: opts.sendToClient,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: { session?: { notes_sent_at?: string | null } }
      }
      if (res.ok) {
        const sent = json.data?.session?.notes_sent_at
        if (typeof sent === 'string') setNotesSentAt(sent)
        onUpdated()
        if (opts.sendToClient) {
          onToast?.('Notes sent ✓', 'success')
        } else {
          onToast?.('Notes saved', 'success')
        }
      } else {
        onToast?.(typeof json.error === 'string' ? json.error : "Couldn't save notes", 'error')
      }
    } finally {
      setNotesSaving(false)
      setNotesSending(false)
    }
  }

  const savePrivateNotesOnly = async () => {
    setNotesSaving(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachPrivateNotes: coachPrivateNotes.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.ok) {
        onUpdated()
        onToast?.('Private notes saved', 'success')
      } else {
        onToast?.(typeof json.error === 'string' ? json.error : "Couldn't save notes", 'error')
      }
    } finally {
      setNotesSaving(false)
    }
  }

  const addActionItem = () => {
    const text = newActionText.trim()
    if (!text || actionDraft.length >= 10) return
    setActionDraft((prev) => [
      ...prev,
      { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ai-${Date.now()}`, text, assignedTo: 'client' },
    ])
    setNewActionText('')
  }

  const removeAction = (id: string) => {
    setActionDraft((prev) => prev.filter((a) => a.id !== id))
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
      const json = (await res.json().catch(() => ({}))) as { queued?: boolean; error?: string }
      if (json.queued === true) {
        onToast?.('Reminder sent successfully — your client should receive it shortly.', 'success')
      } else if (json.queued === false) {
        onToast?.(
          typeof json.error === 'string'
            ? json.error
            : 'Reminder not sent — email reminders are not configured yet.',
          'warning'
        )
      } else if (!res.ok) {
        onToast?.(
          typeof json.error === 'string' ? json.error : "Couldn't send reminder — try again or check your setup.",
          'error'
        )
      } else {
        onToast?.('Reminder sent successfully — your client should receive it shortly.', 'success')
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
        <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Session notes</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNotesTab('client')}
              className={cn(
                'min-h-[40px] flex-1 rounded-lg border px-3 text-[13px] font-medium transition-colors',
                notesTab === 'client'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
              )}
            >
              Client summary
            </button>
            <button
              type="button"
              onClick={() => setNotesTab('private')}
              className={cn(
                'min-h-[40px] flex-1 rounded-lg border px-3 text-[13px] font-medium transition-colors',
                notesTab === 'private'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
              )}
            >
              Private notes
            </button>
          </div>

          {notesTab === 'client' ? (
            <div className="space-y-3">
              {notesSentAt ? (
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  Sent {formatDistanceToNow(new Date(notesSentAt), { addSuffix: true })}
                </span>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Session summary</label>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">Shared with {clientName}</p>
                <textarea
                  value={sessionSummary}
                  onChange={(e) => setSessionSummary(e.target.value.slice(0, 1000))}
                  rows={5}
                  disabled={notesSaving || notesSending}
                  className="mt-2 min-h-[120px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                  placeholder={
                    'How did the session go?\nWhat did you work on?\nWhat progress did you notice?'
                  }
                />
                <p className="mt-1 text-[11px] text-[var(--color-text-secondary)] tabular-nums">
                  {sessionSummary.length} / 1000
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Action items for client</p>
                {actionDraft.length === 0 ? (
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
                    No action items yet. Add specific tasks for {clientName} to complete before next session.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {actionDraft.map((a) => {
                      const live = parseActionItemsJson(session.action_items).find((x) => x.id === a.id)
                      const done = a.assignedTo === 'client' && live?.completed
                      return (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 text-[14px] text-[var(--color-text-primary)]">{a.text}</span>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                            {a.assignedTo === 'coach' ? 'Coach' : 'Client'}
                            {done ? ' · Done' : ''}
                          </span>
                          <button
                            type="button"
                            className="text-[12px] text-red-600 hover:underline"
                            onClick={() => removeAction(a.id)}
                          >
                            Delete
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {actionDraft.length < 10 ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newActionText}
                      onChange={(e) => setNewActionText(e.target.value.slice(0, 200))}
                      placeholder="New action item"
                      className="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[14px]"
                    />
                    <Button type="button" variant="secondary" className="shrink-0" onClick={addActionItem}>
                      Add
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[44px] flex-1"
                  disabled={notesSaving || notesSending}
                  onClick={() => void saveStructuredNotes({ sendToClient: false })}
                >
                  {notesSaving ? 'Saving…' : 'Save privately'}
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] flex-1"
                  disabled={notesSaving || notesSending || !sessionSummary.trim()}
                  onClick={() => void saveStructuredNotes({ sendToClient: true })}
                >
                  {notesSending ? 'Sending…' : 'Send to client'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">Your private notes</label>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">Only you can see this</p>
                <textarea
                  value={coachPrivateNotes}
                  onChange={(e) => setCoachPrivateNotes(e.target.value)}
                  rows={6}
                  disabled={notesSaving}
                  className="mt-2 min-h-[150px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-muted)] px-4 py-3 text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                  placeholder="Observations, concerns, things to remember for next time…"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] w-full sm:w-auto"
                disabled={notesSaving}
                onClick={() => void savePrivateNotesOnly()}
              >
                {notesSaving ? 'Saving…' : 'Save privately'}
              </Button>
            </div>
          )}
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
