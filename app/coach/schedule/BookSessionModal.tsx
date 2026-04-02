'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SESSION_DURATIONS, TIME_SLOTS } from './sessionFormOptions'

type Client = { id: string; first_name: string | null; last_name: string | null }

export interface BookSessionModalProps {
  open: boolean
  onClose: () => void
  onBooked: () => void
  initialClientId?: string | null
  initialDate?: string | null
  initialTime?: string | null
  /** When set, after a new session is created the old session is removed (reschedule flow). */
  rescheduleFromSessionId?: string | null
  initialDurationMinutes?: number | null
}

type SessionPackage = {
  id: string
  title: string
  price_cents: number
  duration_minutes: number
  is_virtual?: boolean | null
  session_type?: string | null
}

type PaymentStep = 'invoice' | 'paid' | 'free'

export function BookSessionModal({
  open,
  onClose,
  onBooked,
  initialClientId = null,
  initialDate = null,
  initialTime = null,
  rescheduleFromSessionId = null,
  initialDurationMinutes = null,
}: BookSessionModalProps) {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [sessionTitle, setSessionTitle] = useState('Coaching session')
  const [sessionType, setSessionType] = useState<'video' | 'phone' | 'in_person'>('video')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('invoice')
  const [packages, setPackages] = useState<SessionPackage[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [customAmount, setCustomAmount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [paidMethod, setPaidMethod] = useState('cash')
  const [paidReference, setPaidReference] = useState('')
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setClientsLoading(true)
    fetch('/api/clients')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setClients(json.data)
          if (initialClientId) {
            setClientId(initialClientId)
          } else if (json.data.length && !clientId) {
            setClientId(json.data[0].id)
          }
        }
      })
      .finally(() => setClientsLoading(false))
  }, [open, initialClientId, clientId])

  useEffect(() => {
    if (!open) return
    fetch('/api/packages')
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.data)) {
          setPackages(json.data.filter((p: SessionPackage & { is_active?: boolean }) => p.is_active !== false))
        }
      })
      .catch(() => {})
  }, [open])

  const isVirtualSession = sessionType === 'video' || sessionType === 'phone'

  useEffect(() => {
    if (!open || step !== 2) return
    const wantVirtual = sessionType === 'video' || sessionType === 'phone'
    const match = packages.find((p) => (p.is_virtual ?? true) === wantVirtual)
    if (match) setSelectedPackageId(match.id)
    else setSelectedPackageId('')
  }, [open, step, sessionType, packages])

  useEffect(() => {
    if (!open) return
    setStep(1)
    setPaymentStep('invoice')
    setError(null)
    setSessionTitle('Coaching session')
    setSessionType('video')
    setSelectedPackageId('')
    setCustomAmount('')
    setPaidAmount('')
    setPaidMethod('cash')
    setPaidReference('')
    setPaidDate(new Date().toISOString().slice(0, 10))
    if (initialDate) setDate(initialDate)
    else setDate('')
    if (initialTime) setStartTime(initialTime)
    if (initialDurationMinutes != null && initialDurationMinutes > 0) {
      setDurationMinutes(initialDurationMinutes)
    }
  }, [open, initialDate, initialTime, initialDurationMinutes])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!clientId || !date || !startTime) {
      setError('Please select a client, date, and time')
      return
    }
    setLoading(true)
    try {
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          date,
          startTime,
          durationMinutes,
          type: sessionType,
          notes: [sessionTitle.trim(), notes.trim()].filter(Boolean).join('\n') || null,
        }),
      })
      const sessionJson = await sessionRes.json()
      if (sessionRes.status === 409) {
        setError(sessionJson.error ?? 'You already have a session at this time. Pick another time.')
        setLoading(false)
        return
      }
      if (!sessionRes.ok) {
        setError(sessionJson.error ?? 'Could not book session')
        setLoading(false)
        return
      }
      const sessionId = sessionJson?.data?.id as string | undefined

      if (paymentStep === 'invoice') {
        let packageId = selectedPackageId
        if (!packageId) {
          const customCents = Math.round((Number.parseFloat(customAmount || '0') || 0) * 100)
          if (customCents < 1) {
            setError('Choose a package or enter a custom amount')
            setLoading(false)
            return
          }
          const pkgRes = await fetch('/api/packages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `${sessionTitle.trim() || 'Custom session'} (custom invoice)`,
              description: 'Auto-created from booking flow',
              price_cents: customCents,
              duration_minutes: durationMinutes,
              session_type: sessionType,
              is_virtual: sessionType === 'video' || sessionType === 'phone',
              is_active: true,
            }),
          })
          const pkgJson = await pkgRes.json().catch(() => ({}))
          if (!pkgRes.ok || !pkgJson?.data?.id) {
            setError(pkgJson.error ?? 'Could not prepare custom invoice')
            setLoading(false)
            return
          }
          packageId = pkgJson.data.id as string
        }
        const invRes = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId, clientId }),
        })
        if (!invRes.ok) {
          const invJson = await invRes.json().catch(() => ({}))
          setError(invJson.error ?? 'Session booked, but invoice could not be sent')
          setLoading(false)
          return
        }
      } else if (paymentStep === 'paid') {
        const paidCents = Math.round((Number.parseFloat(paidAmount || '0') || 0) * 100)
        if (paidCents < 1) {
          setError('Enter a valid paid amount')
          setLoading(false)
          return
        }
        const payRes = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            amountCents: paidCents,
            paymentMethod: paidMethod,
            paymentReference: paidReference.trim() || null,
            notes: `Booked session payment: ${sessionTitle}`,
            paymentDate: paidDate,
            sessionId: sessionId ?? null,
          }),
        })
        if (!payRes.ok) {
          const payJson = await payRes.json().catch(() => ({}))
          setError(payJson.error ?? 'Session booked, but payment record could not be saved')
          setLoading(false)
          return
        }
      }

      if (rescheduleFromSessionId) {
        const delRes = await fetch(`/api/sessions/${rescheduleFromSessionId}`, { method: 'DELETE' })
        if (!delRes.ok) {
          setError(
            'The new session was booked, but the previous time could not be removed automatically. Delete the old session from your calendar.'
          )
          setLoading(false)
          onBooked()
          return
        }
      }
      onBooked()
      onClose()
      setError(null)
      setDate('')
      setStartTime('10:00')
      setDurationMinutes(60)
      setSessionTitle('Coaching session')
      setNotes('')
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const selectedClient = clients.find((c) => c.id === clientId)
  const selectedClientName = selectedClient ? [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || 'Client' : 'Client'

  return (
    <div
      className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-session-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <div
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-lg max-md:max-w-none md:max-w-md md:rounded-xl max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="book-session-title" className="text-lg font-medium text-[var(--color-text-primary)]">
          {rescheduleFromSessionId ? 'Reschedule session' : 'Book session'}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {step === 1 ? '● ○' : '● ●'}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {step === 1 ? (
            <>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Client <span className="text-[var(--color-error)]">*</span>
            </label>
            {!clientsLoading && clients.length === 0 ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 text-center">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Add clients before booking a session
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => {
                    onClose()
                    router.push('/coach/clients')
                  }}
                >
                  Go to Clients
                </Button>
              </div>
            ) : (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
                required
                disabled={clientsLoading}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Session title
            </label>
            <Input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Coaching session"
              maxLength={120}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Date <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Start time <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
            >
              {TIME_SLOTS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Type</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as 'video' | 'phone' | 'in_person')}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
            >
              <option value="video">Video</option>
              <option value="phone">Phone</option>
              <option value="in_person">In person</option>
            </select>
            {isVirtualSession ? (
              <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                Virtual session
              </span>
            ) : (
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                In-person session
              </span>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Duration
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] min-h-[44px]"
            >
              {SESSION_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session focus, goals…"
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] resize-y"
              maxLength={2000}
            />
          </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-fit text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                ← Back to details
              </button>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
                <p className="font-medium text-[var(--color-text-primary)]">{selectedClientName}</p>
                <p className="text-[var(--color-text-secondary)]">
                  {date || 'No date'} · {startTime} · {durationMinutes} min
                </p>
              </div>
              <h3 className="text-base font-medium text-[var(--color-text-primary)]">Payment for this session</h3>
              <div className="space-y-3">
                <label className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3">
                  <input type="radio" checked={paymentStep === 'invoice'} onChange={() => setPaymentStep('invoice')} />
                  <span>
                    <span className="block font-medium">Send invoice</span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">Send client an invoice through messages. They&apos;ll see all your payment methods.</span>
                  </span>
                </label>
                {paymentStep === 'invoice' ? (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
                    <label className="text-sm font-medium">Link to a package (optional)</label>
                    <select
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    >
                      <option value="">Custom amount</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>{p.title} — ${(p.price_cents / 100).toFixed(2)}</option>
                      ))}
                    </select>
                    {!selectedPackageId ? (
                      <Input
                        placeholder="Custom amount (e.g. 120.00)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        inputMode="decimal"
                      />
                    ) : null}
                  </div>
                ) : null}
                <label className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3">
                  <input type="radio" checked={paymentStep === 'paid'} onChange={() => setPaymentStep('paid')} />
                  <span className="font-medium">Mark as already paid</span>
                </label>
                {paymentStep === 'paid' ? (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
                    <Input placeholder="Amount (e.g. 120.00)" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} inputMode="decimal" />
                    <select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                      <option value="cash">Cash</option>
                      <option value="venmo">Venmo</option>
                      <option value="cashapp">CashApp</option>
                      <option value="zelle">Zelle</option>
                      <option value="paypal">PayPal</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="other">Other</option>
                    </select>
                    <Input placeholder="Reference / note (optional)" value={paidReference} onChange={(e) => setPaidReference(e.target.value)} />
                    <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                  </div>
                ) : null}
                <label className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3">
                  <input type="radio" checked={paymentStep === 'free'} onChange={() => setPaymentStep('free')} />
                  <span>
                    <span className="block font-medium">No payment needed</span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">Complimentary or already handled outside the app</span>
                  </span>
                </label>
              </div>
            </>
          )}
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            {step === 1 ? (
              <>
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={clientsLoading || clients.length === 0}
                  onClick={() => setStep(2)}
                >
                  Next: Payment →
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button type="submit" disabled={loading || clientsLoading}>
                  {loading ? 'Booking…' : 'Book session'}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
