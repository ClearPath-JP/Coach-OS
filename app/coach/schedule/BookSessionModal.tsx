'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { SESSION_DURATIONS, labelForTimeValue } from './sessionFormOptions'
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

type DaySession = {
  id?: string
  scheduled_time: string
  duration_minutes?: number | null
  end_time?: string | null
  status?: string | null
}

function clientLabel(c: Client): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'
}

function slotsForDate(date: string, rules: AvailabilityRule[]): string[] {
  const d = new Date(`${date}T12:00:00`)
  const dow = dateToRuleDayOfWeek(d)
  const dayRules = rules.filter((r) => r.day_of_week === dow)
  const out: string[] = []
  if (dayRules.length === 0) {
    // No availability set — show all reasonable hours
    for (let h = 7; h < 21; h++) {
      for (const m of [0, 30]) out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
    return out
  }
  for (const r of dayRules) {
    const sp = r.start_time.slice(0, 5).split(':').map((x) => parseInt(x, 10))
    const ep = r.end_time.slice(0, 5).split(':').map((x) => parseInt(x, 10))
    let cur = (sp[0] ?? 0) * 60 + (sp[1] ?? 0)
    const end = (ep[0] ?? 0) * 60 + (ep[1] ?? 0)
    while (cur < end) {
      const hh = Math.floor(cur / 60)
      const mm = cur % 60
      out.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
      cur += 30
    }
  }
  return [...new Set(out)].sort()
}

function slotOccupied(date: string, slotStart: string, durationMinutes: number, sessions: DaySession[], excludeId: string | null): boolean {
  const [sh, sm] = slotStart.split(':').map((x) => parseInt(x, 10))
  const start = new Date(`${date}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  for (const s of sessions) {
    if (excludeId && s.id === excludeId) continue
    if (s.status && s.status !== 'pending' && s.status !== 'confirmed') continue
    const st = parseISO(s.scheduled_time)
    const en = s.end_time ? parseISO(s.end_time) : new Date(st.getTime() + (s.duration_minutes ?? 60) * 60_000)
    if (start < en && end > st) return true
  }
  return false
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
  const [sessionType, setSessionType] = useState<'in_person' | 'video'>('in_person')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [daySessions, setDaySessions] = useState<DaySession[]>([])

  // Fetch clients + availability on open
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
    fetch('/api/availability')
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json.data)) setRules(json.data.filter((x: AvailabilityRule) => x.is_active)) })
      .catch(() => setRules([]))
  }, [open, initialClientId])

  // Fetch day sessions when date changes
  useEffect(() => {
    if (!open || !date) { setDaySessions([]); return }
    const from = new Date(`${date}T00:00:00`).toISOString()
    const to = new Date(`${date}T23:59:59`).toISOString()
    fetch(`/api/coach/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((json) => setDaySessions(Array.isArray(json.data) ? json.data : []))
      .catch(() => setDaySessions([]))
  }, [open, date])

  // Reset on open
  useEffect(() => {
    if (!open) return
    setError(null)
    setClientSearch('')
    setSessionType('in_person')
    setDate(initialDate ?? '')
    setStartTime(initialTime ?? '10:00')
    setDurationMinutes(initialDurationMinutes && initialDurationMinutes > 0 ? initialDurationMinutes : 60)
  }, [open, initialDate, initialTime, initialDurationMinutes])

  const handleSubmit = async () => {
    setError(null)
    if (!clientId) { setError('Pick a client'); return }
    if (!date) { setError('Pick a date'); return }
    if (!startTime) { setError('Pick a time'); return }
    setLoading(true)
    try {
      // Build the ISO timestamp in the browser (respects local timezone)
      const scheduledIso = new Date(`${date}T${startTime}:00`).toISOString()
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, date, startTime, durationMinutes, type: sessionType, scheduledIso }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Could not book session'); setLoading(false); return }

      if (rescheduleFromSessionId) {
        await fetch(`/api/sessions/${rescheduleFromSessionId}`, { method: 'DELETE' }).catch(() => {})
      }
      onBooked()
      onClose()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => clientLabel(c).toLowerCase().includes(q))
  }, [clients, clientSearch])

  const timeSlots = useMemo(() => (date ? slotsForDate(date, rules) : []), [date, rules])
  const hasPrefilledTime = !!initialDate && !!initialTime

  if (!open) return null

  const dateLabel = date ? format(parseISO(`${date}T12:00:00`), 'EEE, MMM d') : null

  return (
    <div className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div
        className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] shadow-[var(--shadow-lg)] max-md:max-w-none md:max-w-md md:rounded-xl max-md:pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--border-default)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
            {rescheduleFromSessionId ? 'Reschedule' : 'Book Session'}
          </h2>
          {hasPrefilledTime && dateLabel && (
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              {dateLabel} at {labelForTimeValue(startTime)}
            </p>
          )}
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Client picker */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Client</label>
            {clients.length > 6 && (
              <input
                type="search"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search..."
                className="mb-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 py-2 text-[13px] outline-none focus:border-[var(--cp-accent)]"
              />
            )}
            {!clientsLoading && clients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-default)] p-4 text-center">
                <p className="text-[13px] text-[var(--text-secondary)]">Add a client first</p>
                <Button type="button" variant="secondary" className="mt-2" onClick={() => { onClose(); router.push('/coach/clients') }}>
                  Go to Clients
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredClients.map((c) => {
                  const name = clientLabel(c)
                  const active = c.id === clientId
                  const locked = !!rescheduleFromSessionId && !!initialClientId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={locked && !active}
                      onClick={() => setClientId(c.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                        active
                          ? 'border-[var(--cp-accent)] bg-[var(--cp-accent)] text-white'
                          : 'border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-primary)] hover:border-[var(--border-strong)]',
                        locked && !active && 'opacity-30'
                      )}
                    >
                      <span className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                        active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
                      )}>
                        {initials(name)}
                      </span>
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Date (only shown if not pre-filled from grid click) */}
          {!hasPrefilledTime && (
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-4 py-2.5 text-[14px] text-[var(--text-primary)] min-h-[44px]"
              />
              {date && <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{format(parseISO(`${date}T12:00:00`), 'EEEE')}</p>}
            </div>
          )}

          {/* Time slots (only shown if not pre-filled from grid click) */}
          {!hasPrefilledTime && date && (
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Time</label>
              <div className="flex flex-wrap gap-1.5">
                {timeSlots.map((slot) => {
                  const occ = slotOccupied(date, slot, durationMinutes, daySessions, rescheduleFromSessionId)
                  const active = startTime === slot
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setStartTime(slot)}
                      className={cn(
                        'h-8 min-w-[80px] rounded-full border text-[12px] font-medium transition-colors',
                        occ && !active
                          ? 'border-[var(--border-subtle)] text-[var(--text-quaternary)] line-through opacity-50'
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
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Duration</label>
            <div className="flex gap-2">
              {SESSION_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDurationMinutes(d.value)}
                  className={cn(
                    'flex-1 h-9 rounded-lg border text-[13px] font-medium transition-colors',
                    durationMinutes === d.value
                      ? 'border-[var(--cp-accent)] bg-[var(--cp-accent)] text-white'
                      : 'border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Session type */}
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Type</label>
            <div className="flex gap-2">
              {([
                { id: 'in_person' as const, label: 'In person' },
                { id: 'video' as const, label: 'Video' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSessionType(opt.id)}
                  className={cn(
                    'flex-1 h-9 rounded-lg border text-[13px] font-medium transition-colors',
                    sessionType === opt.id
                      ? 'border-[var(--cp-accent)] bg-[var(--cp-accent)] text-white'
                      : 'border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-[13px] text-[var(--error)]" role="alert">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="button" disabled={loading || clientsLoading || !clientId} onClick={() => void handleSubmit()} className="flex-1">
              {loading ? 'Booking...' : 'Book'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
