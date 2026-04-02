'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'

type Parsed = {
  type?: string
  programName?: string | null
  reason?: string
}

export function TestimonialRequestCard({
  content,
  createdAt,
  coachName,
  onSubmitted,
}: {
  content: string
  createdAt: string
  coachName: string
  onSubmitted?: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  let programName: string | null = null
  try {
    const p = JSON.parse(content) as Parsed
    if (p?.type === 'testimonial_request') {
      programName = p.programName ?? null
    }
  } catch {
    /* ignore */
  }

  const title =
    programName && programName !== 'your program'
      ? `How was your experience with ${programName}?`
      : `How was your experience?`

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/client/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, content: text.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not submit')
        return
      }
      setDone(true)
      setModalOpen(false)
      onSubmitted?.()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="max-w-[320px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
        <p className="text-xl" aria-hidden>
          🌟
        </p>
        <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
          We&apos;d love to hear how coaching with {coachName} has helped you.
        </p>
        {done ? (
          <p className="mt-3 text-[13px] font-medium text-emerald-700">Thank you! Your coach will review your testimonial.</p>
        ) : (
          <Button type="button" className="mt-4 min-h-10 w-full" onClick={() => setModalOpen(true)}>
            Leave a review
          </Button>
        )}
        <p className="mt-2 text-[11px] text-[var(--text-quaternary)]">{format(new Date(createdAt), 'h:mm a')}</p>
      </div>

      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Share your experience">
        <p className="text-[14px] text-[var(--text-secondary)]">
          Your review helps {coachName} help more people like you.
        </p>
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">Rating</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`min-h-11 min-w-11 rounded-lg border text-lg transition-colors ${
                  rating >= n
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-tertiary)]'
                }`}
                aria-label={`${n} stars`}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-[13px] font-medium text-[var(--text-primary)]">
            What has changed for you since starting coaching? (optional)
          </label>
          <Textarea
            rows={4}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I've been able to…"
          />
          <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">{text.length}/500</p>
        </div>
        {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Submitting…' : 'Submit review'}
          </Button>
        </div>
      </Modal>
    </>
  )
}
