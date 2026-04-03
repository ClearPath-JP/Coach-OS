'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

const TIME_OF_DAY = [
  { id: 'morning', label: 'Morning', sub: '8am–12pm', time: '10:00', slotLabel: 'Morning (8am-12pm)' },
  { id: 'afternoon', label: 'Afternoon', sub: '12pm–5pm', time: '14:00', slotLabel: 'Afternoon (12pm-5pm)' },
  { id: 'evening', label: 'Evening', sub: '5pm–8pm', time: '18:00', slotLabel: 'Evening (5pm-8pm)' },
] as const

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  const [preferredDate, setPreferredDate] = useState(todayYmd)
  const [timeOfDay, setTimeOfDay] = useState<(typeof TIME_OF_DAY)[number]['id'] | null>(null)
  const [sessionFormat, setSessionFormat] = useState<'video' | 'in_person'>('video')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSuccess(false)
    setTimeOfDay(null)
    setSessionFormat('video')
    setNote('')
    setPreferredDate(initialPreferredDate ?? todayYmd())
  }, [open, initialPreferredDate])

  const submit = async () => {
    setError(null)
    if (!timeOfDay) {
      setError('Choose a time of day')
      return
    }
    const slot = TIME_OF_DAY.find((t) => t.id === timeOfDay)!
    setSubmitting(true)
    try {
      const res = await fetch('/api/client/request-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredDate,
          preferredTime: slot.time,
          timeSlotLabel: slot.slotLabel,
          sessionTypePreference: sessionFormat,
          note: note.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not send request')
        return
      }
      setSuccess(true)
      onSent?.()
    } catch {
      setError('Something went wrong — check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleModalClose = () => {
    if (submitting) return
    onClose()
  }

  return (
    <Modal isOpen={open} onClose={handleModalClose} title="Request a session" className="md:max-w-lg">
      {success ? (
        <div className="space-y-4 px-1 py-2 text-center">
          <p className="text-[20px]" aria-hidden>
            ✓
          </p>
          <p className="text-[17px] font-semibold text-[var(--text-primary)]">Request sent!</p>
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
            Your coach will confirm a time in messages.
          </p>
          <Link
            href="/client/messages"
            onClick={() => onClose()}
            className="flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[14px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            View messages
          </Link>
          <Button type="button" variant="secondary" className="w-full" onClick={() => onClose()}>
            Close
          </Button>
        </div>
      ) : (
        <>
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
            Your coach will confirm the time in messages.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="portal-req-date" className="mb-1 block text-[13px] font-medium text-[var(--text-secondary)]">
                Preferred date
              </label>
              <input
                id="portal-req-date"
                type="date"
                min={todayYmd()}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 text-[14px] text-[var(--text-primary)] focus:outline-none focus:shadow-[var(--focus-ring)]"
              />
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">Preferred time of day</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {TIME_OF_DAY.map((slot) => {
                  const on = timeOfDay === slot.id
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setTimeOfDay(slot.id)}
                      className={cn(
                        'rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-[13px] transition-colors',
                        on
                          ? 'border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]/25'
                          : 'border-[var(--border-default)] bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)]'
                      )}
                    >
                      <span className="font-medium text-[var(--text-primary)]">{slot.label}</span>
                      <span className="mt-0.5 block text-[12px] text-[var(--text-tertiary)]">{slot.sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">Session type</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSessionFormat('video')}
                  className={cn(
                    'rounded-[var(--radius-md)] border px-4 py-3 text-left text-[13px] transition-colors',
                    sessionFormat === 'video'
                      ? 'border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]/25'
                      : 'border-[var(--border-default)] bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)]'
                  )}
                >
                  <span className="font-medium text-[var(--text-primary)]">Video call</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFormat('in_person')}
                  className={cn(
                    'rounded-[var(--radius-md)] border px-4 py-3 text-left text-[13px] transition-colors',
                    sessionFormat === 'in_person'
                      ? 'border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]/25'
                      : 'border-[var(--border-default)] bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)]'
                  )}
                >
                  <span className="font-medium text-[var(--text-primary)]">In person</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="request-session-note" className="mb-1 block text-[13px] font-medium text-[var(--text-secondary)]">
                Note <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
              </label>
              <Textarea
                id="request-session-note"
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What would you like to work on?"
              />
            </div>

            {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

            <Button type="button" variant="primary" className="h-11 w-full" onClick={submit} disabled={submitting || !timeOfDay}>
              {submitting ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
