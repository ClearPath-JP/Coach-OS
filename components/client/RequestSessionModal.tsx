'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return startOfDay(new Date())
  return startOfDay(new Date(y, m - 1, d))
}

const TIME_SLOTS = [
  { id: 'e8', label: 'Early', sub: '8–10am', time: '09:00' },
  { id: 'm10', label: 'Late morning', sub: '10am–12pm', time: '11:00' },
  { id: 'm12', label: 'Midday', sub: '12–2pm', time: '13:00' },
  { id: 'a2', label: 'Afternoon', sub: '2–4pm', time: '15:00' },
  { id: 'a4', label: 'Late afternoon', sub: '4–6pm', time: '17:00' },
  { id: 'e6', label: 'Evening', sub: '6–8pm', time: '19:00' },
] as const

type Slot = (typeof TIME_SLOTS)[number]

export function RequestSessionModal({
  open,
  onClose,
  onSent,
  initialPreferredDate = null,
}: {
  open: boolean
  onClose: () => void
  onSent?: () => void
  initialPreferredDate?: string | null
}) {
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()))
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [sessionFormat, setSessionFormat] = useState<'video' | 'in_person'>('video')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dayOptions = useMemo(() => {
    const start = startOfDay(new Date())
    const base = Array.from({ length: 28 }, (_, i) => addDays(start, i))
    const sel = startOfDay(selectedDay)
    if (base.some((d) => isSameDay(d, sel))) return base
    return [...base, sel].sort((a, b) => a.getTime() - b.getTime())
  }, [selectedDay])

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedSlot(null)
    setSessionFormat('video')
    setNote('')
    if (initialPreferredDate) {
      setSelectedDay(parseYmd(initialPreferredDate))
    } else {
      setSelectedDay(startOfDay(new Date()))
    }
  }, [open, initialPreferredDate])

  const submit = async () => {
    setError(null)
    if (!selectedSlot) {
      setError('Pick a time slot')
      return
    }
    const preferredDate = format(selectedDay, 'yyyy-MM-dd')
    const timeSlotLabel = `${selectedSlot.label} · ${selectedSlot.sub}`
    setSubmitting(true)
    try {
      const res = await fetch('/api/client/request-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredDate,
          preferredTime: selectedSlot.time,
          timeSlotLabel,
          sessionTypePreference: sessionFormat,
          note: note.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not send request')
        return
      }
      onSent?.()
      onClose()
    } catch {
      setError('Something went wrong — check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Request a session" className="md:max-w-lg">
      <p className="text-sm text-[var(--color-muted)]">
        Tap a day, then a time window. Your coach gets it in Messages to confirm.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--color-text-secondary)]">Day</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
            {dayOptions.map((d) => {
              const on = isSameDay(d, selectedDay)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    'flex min-w-[52px] shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center transition-colors',
                    on
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-ink)] hover:bg-[var(--color-surface)]'
                  )}
                >
                  <span className="text-[11px] font-medium uppercase text-[var(--color-muted)]">{format(d, 'EEE')}</span>
                  <span className="text-[15px] font-semibold">{format(d, 'd')}</span>
                  <span className="text-[10px] text-[var(--color-muted)]">{format(d, 'MMM')}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--color-text-secondary)]">Time</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIME_SLOTS.map((slot) => {
              const on = selectedSlot?.id === slot.id
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                    on
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] ring-1 ring-[var(--color-accent)]/30'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface)]'
                  )}
                >
                  <span className="font-medium text-[var(--color-ink)]">{slot.label}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--color-muted)]">{slot.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--color-text-secondary)]">Session type</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSessionFormat('video')}
              className={cn(
                'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                sessionFormat === 'video'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] ring-1 ring-[var(--color-accent)]/30'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface)]'
              )}
            >
              <span className="font-medium text-[var(--color-ink)]">Video (1:1 Zoom)</span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-muted)]">Online call</span>
            </button>
            <button
              type="button"
              onClick={() => setSessionFormat('in_person')}
              className={cn(
                'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                sessionFormat === 'in_person'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] ring-1 ring-[var(--color-accent)]/30'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface)]'
              )}
            >
              <span className="font-medium text-[var(--color-ink)]">In person</span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-muted)]">Meet face to face</span>
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="request-session-note" className="mb-1 block text-[13px] font-medium text-[var(--color-text-secondary)]">
            Note <span className="font-normal text-[var(--color-muted)]">(optional)</span>
          </label>
          <Textarea
            id="request-session-note"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything your coach should know"
          />
        </div>

        {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !selectedSlot}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
