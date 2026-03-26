'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  parseISO,
  isWithinInterval,
} from 'date-fns'

export interface ClientWeekCalendarProps {
  clientId: string
}

type ApiSession = {
  id: string
  scheduled_time: string
  start_time: string
  date: string
  duration_minutes: number | null
  status: string
  type: 'Video' | 'Phone' | 'In person'
}

function useMdUp() {
  const [mdUp, setMdUp] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setMdUp(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mdUp
}

export function ClientWeekCalendar({ clientId }: ClientWeekCalendarProps) {
  const mdUp = useMdUp()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<ApiSession[]>([])

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), [])

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  )

  const displayDays = useMemo(() => {
    if (mdUp) return weekDays
    const today = new Date()
    const idx = weekDays.findIndex((d) => isSameDay(d, today))
    const i = idx === -1 ? 0 : idx
    const from = Math.max(0, i - 1)
    const to = Math.min(weekDays.length, i + 2)
    return weekDays.slice(from, to)
  }, [mdUp, weekDays])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/client/sessions')
        const json = await res.json()
        if (!res.ok || cancelled) return
        const up = (json.data?.upcoming ?? []) as ApiSession[]
        const past = (json.data?.past ?? []) as ApiSession[]
        const merged = [...up, ...past]
        const inWeek = merged.filter((s) => {
          const t = parseISO(s.start_time ?? s.scheduled_time)
          return isWithinInterval(t, { start: weekStart, end: weekEnd })
        })
        inWeek.sort((a, b) =>
          (a.start_time ?? a.scheduled_time).localeCompare(b.start_time ?? b.scheduled_time)
        )
        if (!cancelled) setSessions(inWeek)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, weekStart, weekEnd])

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, ApiSession[]>()
    displayDays.forEach((day, i) => {
      const forDay = sessions.filter((s) => isSameDay(parseISO(s.start_time ?? s.scheduled_time), day))
      map.set(i, forDay)
    })
    return map
  }, [displayDays, sessions])

  const skeletonDays = useMemo(() => {
    if (mdUp) return weekDays
    const today = new Date()
    const idx = weekDays.findIndex((d) => isSameDay(d, today))
    const i = idx === -1 ? 0 : idx
    return weekDays.slice(Math.max(0, i - 1), Math.min(weekDays.length, i + 2))
  }, [mdUp, weekDays])

  if (loading) {
    return (
      <div
        className="grid grid-cols-3 gap-2 md:grid-cols-7"
        aria-busy="true"
        aria-label="Loading calendar"
      >
        {skeletonDays.map((d) => (
          <div key={d.toISOString()} className="flex min-w-0 flex-col gap-2">
            <div className="h-10 animate-pulse rounded-lg bg-[var(--color-border)]" />
            <div className="min-h-[72px] flex-1 animate-pulse rounded-lg bg-[var(--color-border)]/70" />
          </div>
        ))}
      </div>
    )
  }

  const hasAnyThisWeek = sessions.length > 0

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-7">
        {displayDays.map((day, colIdx) => {
          const daySessions = sessionsByDay.get(colIdx) ?? []
          const today = isToday(day)
          return (
            <div key={day.toISOString()} className="flex min-w-0 flex-col">
              <div className="mb-2 flex flex-col items-center gap-0.5 py-2">
                <span className="text-[12px] text-[var(--color-muted)]">{format(day, 'EEE')}</span>
                <span
                  className={`flex h-9 min-w-[36px] items-center justify-center rounded-full px-1 text-[18px] font-medium ${
                    today
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-ink)]'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="flex min-h-[48px] flex-1 flex-col gap-2">
                {daySessions.map((s) => (
                  <SessionDayCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {!hasAnyThisWeek ? (
        <p className="mt-4 text-center text-[12px] text-[var(--color-muted)]">
          No sessions scheduled this week
        </p>
      ) : null}
    </div>
  )
}

function SessionDayCard({ session }: { session: ApiSession }) {
  const t = parseISO(session.start_time ?? session.scheduled_time)
  const mins = session.duration_minutes ?? 60
  const isScheduled = session.status === 'pending' || session.status === 'confirmed'
  const isCompleted = session.status === 'completed'

  return (
    <div
      className={`rounded-lg border bg-[var(--color-bg)] p-2 text-left ${
        isScheduled
          ? 'border-[var(--color-accent)]'
          : isCompleted
            ? 'border-[var(--color-border)] opacity-90'
            : 'border-[var(--color-border)]'
      }`}
    >
      <p className="text-[13px] font-medium text-[var(--color-ink)]">{format(t, 'h:mm a')}</p>
      <p className="text-[11px] text-[var(--color-muted)]">{mins} min</p>
      <span className="mt-1 inline-block rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
        {session.type}
      </span>
      <p
        className={`mt-1 text-[10px] font-medium ${
          isCompleted ? 'text-[var(--color-muted)]' : 'text-[var(--color-accent)]'
        }`}
      >
        {isScheduled ? 'Scheduled' : session.status}
      </p>
    </div>
  )
}
