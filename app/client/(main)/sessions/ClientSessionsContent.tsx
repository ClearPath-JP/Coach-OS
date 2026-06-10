'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { RequestSessionModal } from '@/components/client/RequestSessionModal'
import { WeeklyUnavailabilityEditor } from '@/components/unavailability/WeeklyUnavailabilityEditor'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

type ApiSession = {
  id: string
  scheduled_time: string
  end_time?: string | null
  duration_minutes?: number | null
  status: string
  session_type?: string | null
  type?: string | null
  notes?: string | null
}

function typeLabel(t: string | null | undefined): string {
  if (t === 'in_person') return 'In person'
  if (t === 'video') return 'Video'
  if (t === 'phone') return 'Phone call'
  return 'Session'
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  rescheduled: 'Rescheduled',
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '))
}

export function ClientSessionsContent() {
  // Stripe Checkout for class bookings redirects back here with ?booked=1 (success)
  // or ?booking_cancelled=1 (cancel) — see /api/client/book-class.
  const searchParams = useSearchParams()
  const justBooked = searchParams.get('booked') === '1'
  const bookingCancelled = searchParams.get('booking_cancelled') === '1'

  const [upcoming, setUpcoming] = useState<ApiSession[]>([])
  const [past, setPast] = useState<ApiSession[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [pastOpen, setPastOpen] = useState(true)
  const [banner, setBanner] = useState<{ type: 'success' | 'warning'; text: string } | null>(
    justBooked
      ? { type: 'success', text: "You're booked! Your session may take a moment to appear." }
      : bookingCancelled
        ? { type: 'warning', text: 'Checkout cancelled — you have not been charged.' }
        : null
  )

  // Auto-dismiss banner after 6s (mirrors ClientClassesContent)
  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 6000)
    return () => window.clearTimeout(t)
  }, [banner])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/sessions')
      const json = await res.json()
      if (json.data) {
        setUpcoming((json.data.upcoming ?? []) as ApiSession[])
        setPast((json.data.past ?? []) as ApiSession[])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const pastTen = useMemo(() => past.slice(0, 10), [past])

  return (
    <div className="client-page-content mx-auto max-w-[640px] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">Sessions</h1>
        <Button type="button" variant="primary" size="sm" className="shrink-0" onClick={() => setRequestOpen(true)}>
          Request a session
        </Button>
      </div>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-[var(--cp-accent)]/30 bg-[var(--cp-accent)]/10 text-[var(--cp-accent)]'
              : 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <p>{banner.text}</p>
        </div>
      )}

      <section>
        <p className="mb-3 font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Upcoming</p>
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-muted)]" />
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming sessions"
            action={
              <Button type="button" variant="secondary" size="sm" onClick={() => setRequestOpen(true)}>
                Request a session
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {upcoming.map((s) => {
              const start = parseISO(s.scheduled_time)
              const dur = s.duration_minutes ?? 60
              const stype = typeLabel(s.session_type ?? s.type)
              const minsUntil = (start.getTime() - Date.now()) / (1000 * 60)
              const within24h = minsUntil > 0 && minsUntil < 24 * 60
              const isTomorrow = within24h && minsUntil > 12 * 60
              const isToday = within24h && minsUntil <= 12 * 60
              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--cp-offwhite)] shadow-[5px_5px_0_var(--ink)]"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-[family-name:var(--font-display)] text-[19px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{format(start, 'EEEE, MMMM d')}</p>
                      <span className="arcade-badge shrink-0">{stype}</span>
                    </div>
                    <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                      {format(start, 'h:mm a')} · {dur} minutes
                    </p>
                    {within24h ? (
                      <div className="mt-3 inline-flex items-center gap-2">
                        <span className="arcade-badge arcade-badge-yellow">
                          {isToday ? 'Today!' : isTomorrow ? 'Tomorrow!' : 'Coming up soon'}
                        </span>
                        {minsUntil > 0 && minsUntil < 24 * 60 ? (
                          <span className="font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-secondary)]">
                            in {Math.max(0, Math.floor(minsUntil / 60))}h {Math.max(0, Math.floor(minsUntil % 60))}m
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {s.notes?.trim() ? (
                      <p className="mt-3 text-[14px] italic text-[var(--text-tertiary)]">{s.notes.trim()}</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => setPastOpen((v) => !v)}
          className="mb-3 flex w-full items-center justify-between text-left font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
        >
          Past sessions
          <span aria-hidden>{pastOpen ? '▾' : '▸'}</span>
        </button>
        {pastOpen ? (
          loading ? (
            <div className="h-16 animate-pulse rounded-lg bg-[var(--bg-muted)]" />
          ) : pastTen.length === 0 ? (
            <p className="text-[14px] text-[var(--text-tertiary)]">No past sessions yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {pastTen.map((s) => {
                const start = parseISO(s.scheduled_time)
                const dur = s.duration_minutes ?? 60
                const stype = typeLabel(s.session_type ?? s.type)
                const done = s.status === 'completed'
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
                    <span className="font-[family-name:var(--font-display)] font-bold text-[var(--text-primary)]">{format(start, 'MMM d, yyyy')}</span>
                    <span className="text-[var(--text-tertiary)]">
                      {dur} min · {stype}
                    </span>
                    <span className={cn('arcade-badge', done && 'arcade-badge-teal')}>
                      {statusLabel(s.status)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </section>

      <section>
        <p className="mb-2 font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Times you&apos;re usually unavailable
        </p>
        <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
          Help your coach avoid proposing sessions when you typically can&apos;t make it. This is optional.
        </p>
        <WeeklyUnavailabilityEditor variant="client" />
      </section>

      <RequestSessionModal open={requestOpen} onClose={() => setRequestOpen(false)} onSent={() => void loadSessions()} />
    </div>
  )
}
