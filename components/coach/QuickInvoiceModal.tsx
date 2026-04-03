'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PAYMENT_METHOD_LABELS, type PaymentMethodValue } from '@/lib/payment-methods'

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; email: string | null }

export function QuickInvoiceModal({
  open,
  onClose,
  defaultClientId,
  onSent,
}: {
  open: boolean
  onClose: () => void
  /** When set (e.g. client detail), pre-select this client and hide selector if only one. */
  defaultClientId?: string | null
  onSent?: (clientName: string) => void
}) {
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [methods, setMethods] = useState<PaymentMethodValue[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadContext = useCallback(async () => {
    setLoadingClients(true)
    setError(null)
    try {
      const [clRes, stRes] = await Promise.all([fetch('/api/clients?limit=200'), fetch('/api/settings')])
      const clJson = await clRes.json().catch(() => ({}))
      const stJson = await stRes.json().catch(() => ({}))
      const list = (clJson.data ?? []) as ClientOpt[]
      setClients(list)
      const preferred = stJson?.data?.workspace?.preferredPaymentMethods as PaymentMethodValue[] | undefined
      setMethods(Array.isArray(preferred) ? preferred : [])
    } catch {
      setClients([])
      setMethods([])
    } finally {
      setLoadingClients(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadContext()
  }, [open, loadContext])

  useEffect(() => {
    if (!open) return
    if (defaultClientId) {
      setClientId(defaultClientId)
      return
    }
    setClientId('')
  }, [open, defaultClientId])

  const selected = clients.find((c) => c.id === clientId)
  const clientLabel =
    [selected?.first_name, selected?.last_name].filter(Boolean).join(' ').trim() ||
    selected?.email?.split('@')[0] ||
    'this client'

  const submit = async () => {
    setError(null)
    const dollars = parseFloat(amount)
    if (!clientId || Number.isNaN(dollars) || dollars < 1) {
      setError('Choose a client and enter an amount of at least $1.')
      return
    }
    const priceCents = Math.round(dollars * 100)
    const title = (description.trim() || 'Invoice').slice(0, 100)
    const desc = description.trim().slice(0, 100)
    setLoading(true)
    try {
      const pkgRes = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: desc || null,
          price_cents: priceCents,
          session_type: 'video',
          is_active: true,
        }),
      })
      const pkgJson = await pkgRes.json().catch(() => ({}))
      if (!pkgRes.ok) {
        setError((pkgJson as { error?: string }).error ?? 'Could not create package')
        return
      }
      const packageId = (pkgJson as { data?: { id?: string } }).data?.id
      if (!packageId) {
        setError('Could not create package')
        return
      }
      const invRes = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, clientId }),
      })
      const invJson = await invRes.json().catch(() => ({}))
      if (!invRes.ok) {
        setError((invJson as { error?: string }).error ?? 'Could not send invoice')
        return
      }
      onSent?.(clientLabel)
      setAmount('')
      setDescription('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Quick invoice" className="max-w-md">
      <p className="mb-4 text-[14px] text-[var(--text-secondary)]">
        Send invoice to <span className="font-medium text-[var(--text-primary)]">{clientLabel}</span>
      </p>

      {loadingClients ? (
        <p className="mb-4 text-[13px] text-[var(--text-tertiary)]">Loading…</p>
      ) : (
        <>
          {!defaultClientId ? (
            <label className="mb-3 block">
              <span className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Client</span>
              <select
                className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[15px]"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                aria-label="Client"
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="mb-3 block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Amount (USD)</span>
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full"
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
              Description <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 100))}
              placeholder="e.g. 4-session pack"
              rows={2}
              className="w-full resize-none"
            />
            <span className="mt-0.5 block text-[11px] text-[var(--text-quaternary)]">
              {description.length}/100
            </span>
          </label>

          {methods.length > 0 ? (
            <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Payment methods you accept
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {methods.map((m) => (
                  <li
                    key={m}
                    className="rounded-full bg-[var(--cp-offwhite)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]"
                  >
                    {PAYMENT_METHOD_LABELS[m] ?? m}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">
              Set preferred payment methods in Workspace settings so clients know how to pay.
            </p>
          )}

          {error ? <p className="mb-3 text-[13px] text-[var(--error)]">{error}</p> : null}

          <Button type="button" className="w-full min-h-11" disabled={loading} onClick={() => void submit()}>
            {loading ? 'Sending…' : 'Send invoice'}
          </Button>
        </>
      )}
    </Modal>
  )
}
