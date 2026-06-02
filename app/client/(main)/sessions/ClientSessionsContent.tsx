'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
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
  if (t === 'video' || t === 'phone') return 'Video'
  return 'Session'
}

export function ClientSessionsContent() {
  const [upcoming, setUpcoming] = useState<ApiSession[]>([])
  const [past, setPast] = useState<ApiSession[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [pastOpen, setPastOpen] = useState(true)

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
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">Sessions</h1>
        <Button type="button" variant="primary" size="sm" className="shrink-0" onClick={() => setRequestOpen(true)}>
          Request a session
        </Button>
      </div>

      <section>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Upcoming</p>
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
                  className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] shadow-[var(--shadow-xs)]"
                >
                  <div className="p-4">
                    <p className="text-[18px] font-bold text-[var(--text-primary)]">{format(start, 'EEEE, MMMM d')}</p>
                    <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                      {format(start, 'h:mm a')} · {dur} minutes
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-[var(--accent-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cp-accent)]">
                      {stype}
                    </span>
                    {within24h ? (
                      <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--accent-light)] px-3 py-2 text-[13px] font-medium text-[var(--cp-accent)]">
                        {isToday ? 'Today!' : isTomorrow ? 'Tomorrow!' : 'Coming up soon'}
                        {minsUntil > 0 && minsUntil < 24 * 60 ? (
                          <span className="ml-1 text-[var(--text-secondary)]">
                            · {Math.max(0, Math.floor(minsUntil / 60))}h {Math.max(0, Math.floor(minsUntil % 60))}m
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
          className="mb-3 flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
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
                    <span className="font-medium text-[var(--text-primary)]">{format(start, 'MMM d, yyyy')}</span>
                    <span className="text-[var(--text-tertiary)]">
                      {dur} min · {stype}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        done ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
                      )}
                    >
                      {done ? 'Completed' : s.status === 'cancelled' ? 'Cancelled' : s.status}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </section>

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
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
