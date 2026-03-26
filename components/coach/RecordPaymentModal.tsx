'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import {
  RECORD_PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_STYLES,
  type PaymentMethodValue,
} from '@/lib/payment-methods'
import { cn } from '@/lib/utils'

type ClientRow = {
  id: string
  first_name: string | null
  last_name: string | null
}

type InvoiceRow = {
  id: string
  amount_cents: number
  session_packages?: { title: string } | null
}

export type EditingPayment = {
  id: string
  clientId: string
  amountCents: number
  paymentMethod: PaymentMethodValue
  paymentReference: string | null
  notes: string | null
  paymentDate: string
  invoiceId: string | null
  sessionId: string | null
}

export interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  /** Called after a successful create (not edit). Use for toast + refresh. */
  onRecorded?: (detail: { clientName: string; amountCents: number }) => void
  onUpdated?: () => void
  defaultClientId?: string | null
  editingPayment?: EditingPayment | null
}

function clientLabel(c: ClientRow): string {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ')
  return n || 'Unnamed client'
}

function dollarsToCents(raw: string): number | null {
  const t = raw.replace(/[^0-9.]/g, '')
  if (!t) return null
  const n = Number.parseFloat(t)
  if (Number.isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

function centsToInput(cents: number): string {
  const d = cents / 100
  if (Number.isInteger(d)) return String(d)
  return d.toFixed(2)
}

export function RecordPaymentModal({
  open,
  onClose,
  onRecorded,
  onUpdated,
  defaultClientId,
  editingPayment,
}: RecordPaymentModalProps) {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [clientId, setClientId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [method, setMethod] = useState<PaymentMethodValue>('venmo')
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [linkInvoice, setLinkInvoice] = useState(false)
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceRow[]>([])
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(editingPayment?.id)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editingPayment) {
      setClientId(editingPayment.clientId)
      setAmountStr(centsToInput(editingPayment.amountCents))
      setMethod(editingPayment.paymentMethod)
      setPayDate(editingPayment.paymentDate)
      setReference(editingPayment.paymentReference ?? '')
      setNotes(editingPayment.notes ?? '')
      setLinkInvoice(Boolean(editingPayment.invoiceId))
      setInvoiceId(editingPayment.invoiceId)
    } else {
      setClientId(defaultClientId ?? '')
      setAmountStr('')
      setMethod('venmo')
      setPayDate(format(new Date(), 'yyyy-MM-dd'))
      setReference('')
      setNotes('')
      setLinkInvoice(false)
      setInvoiceId(null)
    }
  }, [open, editingPayment, defaultClientId])

  useEffect(() => {
    if (!open) return
    setLoadingClients(true)
    fetch('/api/clients?status=active')
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setClients(json.data)
      })
      .catch(() => setError('Could not load clients'))
      .finally(() => setLoadingClients(false))
  }, [open])

  useEffect(() => {
    if (!open || !linkInvoice || !clientId) {
      setPendingInvoices([])
      return
    }
    fetch(`/api/invoices?clientId=${encodeURIComponent(clientId)}&status=pending`)
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setPendingInvoices(json.data)
      })
      .catch(() => {})
  }, [open, linkInvoice, clientId])

  useEffect(() => {
    if (!linkInvoice || !invoiceId) return
    const inv = pendingInvoices.find((i) => i.id === invoiceId)
    if (inv && !isEdit) {
      setAmountStr(centsToInput(inv.amount_cents))
    }
  }, [invoiceId, pendingInvoices, linkInvoice, isEdit])

  const handleSubmit = async () => {
    setError(null)
    if (!clientId) {
      setError('Choose a client')
      return
    }
    const cents = dollarsToCents(amountStr)
    if (cents === null || cents < 1) {
      setError('Enter a valid amount of at least $0.01')
      return
    }
    if (notes.length > 200) {
      setError('Notes must be 200 characters or less')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        clientId,
        amountCents: cents,
        paymentMethod: method,
        paymentReference: reference.trim() || null,
        notes: notes.trim() || null,
        paymentDate: payDate,
        invoiceId: linkInvoice ? invoiceId : null,
        sessionId: null,
      }
      const url = isEdit ? `/api/payments/${editingPayment!.id}` : '/api/payments'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                clientId,
                amountCents: cents,
                paymentMethod: method,
                paymentReference: reference.trim() || null,
                notes: notes.trim() || null,
                paymentDate: payDate,
                invoiceId: editingPayment?.invoiceId ?? null,
                sessionId: editingPayment?.sessionId ?? null,
              }
            : body
        ),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not save payment')
        return
      }
      if (isEdit) {
        onUpdated?.()
      } else {
        const c = clients.find((x) => x.id === clientId)
        onRecorded?.({ clientName: c ? clientLabel(c) : 'Client', amountCents: cents })
      }
      onClose()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const title = isEdit ? 'Edit payment' : 'Record payment'

  return (
    <Modal isOpen={open} onClose={onClose} title={title} className="w-full max-w-none md:max-w-lg md:max-h-[90vh] md:overflow-y-auto">
      {loadingClients ? (
        <p className="text-sm text-[var(--color-muted)]">Loading clients…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-[14px] font-medium text-[var(--color-ink)]">
              Client <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[15px] text-[var(--color-ink)] min-h-[44px]"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[14px] font-medium text-[var(--color-ink)]">
              Amount <span className="text-[var(--color-error)]">*</span>
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">$</span>
              <Input
                className="pl-7"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className="text-[14px] font-medium text-[var(--color-ink)]">
              Payment method <span className="text-[var(--color-error)]">*</span>
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {RECORD_PAYMENT_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value)}
                  className={cn(
                    'min-h-[44px] rounded-full px-3 py-1.5 text-[13px] font-medium transition-opacity',
                    PAYMENT_METHOD_STYLES[opt.value],
                    method === opt.value ? 'ring-2 ring-offset-1 ring-[var(--color-accent)]' : 'opacity-80 hover:opacity-100'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[14px] font-medium text-[var(--color-ink)]">Payment date</label>
            <Input
              type="date"
              className="mt-1"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[14px] font-medium text-[var(--color-ink)]">Reference (optional)</label>
            <Input
              className="mt-1"
              placeholder="Transaction ID, confirmation #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[14px] font-medium text-[var(--color-ink)]">Notes (optional)</label>
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{notes.length}/200</p>
          </div>

          {!isEdit && (
            <div className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkInvoice}
                  onChange={(e) => {
                    setLinkInvoice(e.target.checked)
                    if (!e.target.checked) setInvoiceId(null)
                  }}
                  className="size-4 rounded border-[var(--color-border)]"
                />
                <span className="text-[14px] font-medium text-[var(--color-ink)]">Link to invoice</span>
              </label>
              {linkInvoice && clientId ? (
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-[15px] min-h-[44px]"
                  value={invoiceId ?? ''}
                  onChange={(e) => setInvoiceId(e.target.value || null)}
                >
                  <option value="">Select pending invoice</option>
                  {pendingInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {(inv.session_packages as { title?: string } | undefined)?.title ?? 'Invoice'} —{' '}
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                        inv.amount_cents / 100
                      )}
                    </option>
                  ))}
                </select>
              ) : linkInvoice ? (
                <p className="text-sm text-[var(--color-muted)]">Select a client to see pending invoices.</p>
              ) : null}
            </div>
          )}

          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Record payment'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
