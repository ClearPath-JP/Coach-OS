'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
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
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [notes, setNotes] = useState('')
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
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          date,
          startTime,
          durationMinutes,
          type: 'video',
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        setError(json.error ?? 'You already have a session at this time. Pick another time.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not book session')
        setLoading(false)
        return
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
      setNotes('')
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

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
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Client <span className="text-[var(--color-error)]">*</span>
            </label>
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
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || clientsLoading}>
              {loading ? 'Booking…' : rescheduleFromSessionId ? 'Book new time' : 'Book session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
