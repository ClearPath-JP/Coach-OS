'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { SESSION_DURATIONS, labelForTimeValue, twelveHourLabel } from './sessionFormOptions'
import { dateToRuleDayOfWeek, initials, type AvailabilityRule } from './schedule-lib'

type Client = { id: string; first_name: string | null; last_name: string | null; status?: string }

export interface BookSessionModalProps {
  open: boolean
  onClose: () => void
  onBooked: () => void
  initialClientId?: string | null
  initialDate?: string | null
  initialTime?: string | null
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

type DaySession = {
  id?: string
  scheduled_time: string
  duration_minutes?: number | null
  end_time?: string | null
}

function clientLabel(c: Client): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'
}

function slotOccupied(
  date: string,
  slotStart: string,
  durationMinutes: number,
  sessions: DaySession[],
  excludeRescheduleId: string | null
): boolean {
  const [sh, sm] = slotStart.split(':').map((x) => parseInt(x, 10))
  const start = new Date(`${date}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  for (const s of sessions) {
    if (excludeRescheduleId && s.id === excludeRescheduleId) continue
    const st = parseISO(s.scheduled_time)
    const en = s.end_time
      ? parseISO(s.end_time)
      : new Date(st.getTime() + (s.duration_minutes ?? 60) * 60_000)
    if (start < en && end > st) return true
  }
  return false
}

function slotsForDate(date: string, rules: AvailabilityRule[]): string[] {
  const d = new Date(`${date}T12:00:00`)
  const dow = dateToRuleDayOfWeek(d)
  const dayRules = rules.filter((r) => r.day_of_week === dow)
  const out: string[] = []
  if (dayRules.length === 0) {
    for (let h = 8; h < 20; h++) {
      for (const m of [0, 30]) {
        out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
    }
    return out
  }
  for (const r of dayRules) {
    const sp = r.start_time.slice(0, 5).split(':').map((x) => parseInt(x, 10))
    const ep = r.end_time.slice(0, 5).split(':').map((x) => parseInt(x, 10))
    const sh = sp[0] ?? 0
    const sm = sp[1] ?? 0
    const eh = ep[0] ?? 0
    const em = ep[1] ?? 0
    let cur = sh * 60 + sm
    const end = eh * 60 + em
    while (cur < end) {
      const hh = Math.floor(cur / 60)
      const mm = cur % 60
      out.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
      cur += 30
    }
  }
  return [...new Set(out)].sort()
}

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
  const [clientSearch, setClientSearch] = useState('')
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
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [daySessions, setDaySessions] = useState<DaySession[]>([])

  useEffect(() => {
    if (!open) return
    setClientsLoading(true)
    fetch('/api/clients')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setClients(json.data)
          if (initialClientId) setClientId(initialClientId)
          else if (json.data[0]) setClientId(json.data[0].id)
          else setClientId('')
        }
      })
      .finally(() => setClientsLoading(false))
  }, [open, initialClientId])

  useEffect(() => {
    if (!open) return
    fetch('/api/availability')
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) {
          setRules(json.data.filter((x: AvailabilityRule) => x.is_active))
        }
      })
      .catch(() => setRules([]))
  }, [open])

  useEffect(() => {
    if (!open || !date) {
      setDaySessions([])
      return
    }
    const from = new Date(`${date}T00:00:00`).toISOString()
    const to = new Date(`${date}T23:59:59`).toISOString()
    fetch(`/api/coach/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((json) => {
        setDaySessions(Array.isArray(json.data) ? json.data : [])
      })
      .catch(() => setDaySessions([]))
  }, [open, date])

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
    setClientSearch('')
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
    else setStartTime('10:00')
    if (initialDurationMinutes != null && initialDurationMinutes > 0) {
      setDurationMinutes(initialDurationMinutes)
    } else {
      setDurationMinutes(60)
    }
  }, [open, initialDate, initialTime, initialDurationMinutes])

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
  const selectedClientName = selectedClient ? clientLabel(selectedClient) : 'Client'

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => clientLabel(c).toLowerCase().includes(q))
  }, [clients, clientSearch])

  const timeSlotOptions = useMemo(() => (date ? slotsForDate(date, rules) : []), [date, rules])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-session-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <div
        className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-[var(--shadow-lg)] max-md:max-w-none md:max-w-lg md:rounded-xl max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="book-session-title" className="text-lg font-semibold text-[var(--text-primary)]">
          {rescheduleFromSessionId ? 'Reschedule session' : 'Book session'}
        </h2>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold',
                step === 1 ? 'bg-[var(--cp-accent)] text-white' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
              )}
            >
              1
            </div>
            <div className="h-px w-8 bg-[var(--border-default)]" />
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold',
                step === 2 ? 'bg-[var(--cp-accent)] text-white' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
              )}
            >
              2
            </div>
          </div>
          <div className="text-[12px] text-[var(--text-tertiary)]">
            <span className={step === 1 ? 'font-medium text-[var(--text-primary)]' : ''}>Details</span>
            <span className="mx-1">·</span>
            <span className={step === 2 ? 'font-medium text-[var(--text-primary)]' : ''}>Payment</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          {step === 1 ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                  Client <span className="text-[var(--error)]">*</span>
                </label>
                {!clientsLoading && clients.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-4 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">Add clients before booking a session</p>
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
                  <>
                    <input
                      type="search"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search clients"
                      className="mb-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 py-2 text-sm"
                    />
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-[var(--border-default)] p-2">
                      {filteredClients.map((c) => {
                        const name = clientLabel(c)
                        const active = c.id === clientId
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setClientId(c.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors',
                              active
                                ? 'border-[var(--cp-accent)] bg-[var(--accent-light)] ring-1 ring-[var(--cp-accent)]'
                                : 'border-transparent hover:bg-[var(--bg-subtle)]'
                            )}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--cp-accent)] text-sm text-white">
                              {initials(name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
                              {c.status ? (
                                <p className="text-[11px] capitalize text-[var(--text-tertiary)]">{c.status}</p>
                              ) : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Session title</label>
                <Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="Coaching session" maxLength={120} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                  Date <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={today}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-4 py-3 text-[var(--text-primary)] min-h-[44px]"
                  required
                />
                {date ? (
                  <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{format(parseISO(`${date}T12:00:00`), 'EEEE')}</p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">
                  {date ? `Available times for ${format(parseISO(`${date}T12:00:00`), 'MMM d')}:` : 'Pick a date to see times'}
                </p>
                {date ? (
                  <div className="flex flex-wrap gap-2">
                    {timeSlotOptions.map((slot) => {
                      const occ = slotOccupied(date, slot, durationMinutes, daySessions, rescheduleFromSessionId)
                      const active = startTime === slot
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={occ}
                          onClick={() => setStartTime(slot)}
                          className={cn(
                            'h-9 min-w-[90px] rounded-[var(--radius-md)] border text-[13px] font-medium transition-colors',
                            occ
                              ? 'cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-quaternary)] line-through'
                              : active
                                ? 'border-[var(--cp-accent)] bg-[var(--cp-accent)] text-white'
                                : 'border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                          )}
                        >
                          {labelForTimeValue(slot)}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Duration</p>
                <div className="flex flex-wrap gap-2">
                  {SESSION_DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDurationMinutes(d.value)}
                      className={cn(
                        'h-9 min-w-[72px] rounded-[var(--radius-md)] border text-[13px] font-medium',
                        durationMinutes === d.value
                          ? 'border-[var(--cp-accent)] bg-[var(--cp-accent)] text-white'
                          : 'border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-primary)]'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Type</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { id: 'video' as const, icon: '📹', label: 'Video call' },
                      { id: 'phone' as const, icon: '📞', label: 'Phone call' },
                      { id: 'in_person' as const, icon: '🏃', label: 'In person' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSessionType(opt.id)}
                      className={cn(
                        'flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border p-3 text-[13px] font-medium transition-colors',
                        sessionType === opt.id
                          ? 'border-[var(--cp-accent)] bg-[var(--accent-light)] text-[var(--cp-accent)]'
                          : 'border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-primary)]'
                      )}
                    >
                      <span className="text-xl" aria-hidden>
                        {opt.icon}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {isVirtualSession ? (
                  <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Virtual session</p>
                ) : (
                  <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">In-person session</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for this session…"
                  rows={2}
                  style={{ minHeight: 60 }}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                  maxLength={2000}
                />
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-fit text-sm font-medium text-[var(--cp-accent)] hover:underline"
              >
                ← Back to details
              </button>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3 text-sm">
                <p className="font-semibold text-[var(--text-primary)]">{selectedClientName}</p>
                <p className="text-[var(--text-secondary)]">
                  {date ? format(parseISO(`${date}T12:00:00`), 'EEE, MMM d') : '—'} · {twelveHourLabel(parseInt(startTime.slice(0, 2), 10), parseInt(startTime.slice(3, 5), 10))} ·{' '}
                  {durationMinutes} min
                </p>
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Payment for this session</h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentStep('invoice')}
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border p-4 text-left transition-colors',
                    paymentStep === 'invoice'
                      ? 'border-[var(--cp-accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border-default)] bg-[var(--cp-offwhite)]'
                  )}
                >
                  <span className="text-lg" aria-hidden>
                    📄
                  </span>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">Send invoice</p>
                  <p className="text-sm text-[var(--text-secondary)]">Client sees payment methods in messages.</p>
                </button>
                {paymentStep === 'invoice' ? (
                  <div className="space-y-2 rounded-lg border border-[var(--border-default)] p-3">
                    <label className="text-sm font-medium">Package or amount</label>
                    <select
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 py-2 text-sm"
                    >
                      <option value="">Custom amount</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} — ${(p.price_cents / 100).toFixed(2)}
                        </option>
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

                <button
                  type="button"
                  onClick={() => setPaymentStep('paid')}
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border p-4 text-left transition-colors',
                    paymentStep === 'paid'
                      ? 'border-[var(--cp-accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border-default)] bg-[var(--cp-offwhite)]'
                  )}
                >
                  <span className="text-lg" aria-hidden>
                    💰
                  </span>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">Mark as paid</p>
                  <p className="text-sm text-[var(--text-secondary)]">Record a payment that was already made.</p>
                </button>
                {paymentStep === 'paid' ? (
                  <div className="space-y-2 rounded-lg border border-[var(--border-default)] p-3">
                    <Input placeholder="Amount (e.g. 120.00)" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} inputMode="decimal" />
                    <select
                      value={paidMethod}
                      onChange={(e) => setPaidMethod(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="venmo">Venmo</option>
                      <option value="cashapp">CashApp</option>
                      <option value="zelle">Zelle</option>
                      <option value="paypal">PayPal</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="other">Other</option>
                    </select>
                    <Input placeholder="Reference (optional)" value={paidReference} onChange={(e) => setPaidReference(e.target.value)} />
                    <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setPaymentStep('free')}
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border p-4 text-left transition-colors',
                    paymentStep === 'free'
                      ? 'border-[var(--cp-accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border-default)] bg-[var(--cp-offwhite)]'
                  )}
                >
                  <span className="text-lg" aria-hidden>
                    🎁
                  </span>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">No payment needed</p>
                  <p className="text-sm text-[var(--text-secondary)]">Complimentary or already handled.</p>
                </button>
              </div>
            </>
          )}
          {error ? (
            <p className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 justify-end">
            {step === 1 ? (
              <>
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="button" disabled={clientsLoading || clients.length === 0} onClick={() => setStep(2)}>
                  Next: Payment
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
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
