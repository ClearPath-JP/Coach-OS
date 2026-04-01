'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Button } from '@/components/ui/Button'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type ClientCalendarSession = {
  id: string
  scheduled_time: string
  start_time?: string
  duration_minutes: number | null
  status: string
  notes: string | null
  type?: string
}

export function ClientSessionsMonthCalendar({
  sessions,
  loading,
  onSelectDayForRequest,
  onSelectSession,
}: {
  sessions: ClientCalendarSession[]
  loading: boolean
  onSelectDayForRequest: (date: Date) => void
  onSelectSession: (session: ClientCalendarSession) => void
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    return Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i))
  }, [monthCursor])

  const byDate = useMemo(() => {
    const map = new Map<string, ClientCalendarSession[]>()
    for (const s of sessions) {
      const key = format(parseISO(s.scheduled_time), 'yyyy-MM-dd')
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
    }
    return map
  }, [sessions])

  if (loading) {
    return (
      <div
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 md:p-4"
        aria-busy="true"
        aria-label="Loading calendar"
      >
        <div className="mb-3 h-8 w-48 animate-pulse rounded bg-[var(--color-surface)]" />
        <div className="grid grid-cols-7 gap-px rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] overflow-hidden">
          {monthDays.map((d) => (
            <div key={d.toISOString()} className="min-h-[72px] bg-[var(--color-bg)] p-1 md:min-h-[96px]">
              <div className="h-5 w-6 animate-pulse rounded bg-[var(--color-surface)]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">{format(monthCursor, 'MMMM yyyy')}</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMonthCursor((d) => addMonths(d, -1))}>
            Previous
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMonthCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMonthCursor((d) => addMonths(d, 1))}>
            Next
          </Button>
        </div>
      </div>

      <p className="mb-3 text-[12px] text-[var(--color-muted)] md:text-[13px]">
        Booked sessions show under each date. Open request to pick a day, time slot, and Zoom or in person.
      </p>

      <div className="grid grid-cols-7 gap-px rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] overflow-hidden">
        {WEEKDAYS.map((name) => (
          <div
            key={name}
            className="bg-[var(--color-surface)] px-1 py-2 text-center text-[11px] font-medium text-[var(--color-muted)] md:text-xs"
          >
            {name}
          </div>
        ))}
        {monthDays.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const daySessions = byDate.get(key) ?? []
          const inMonth = isSameMonth(d, monthCursor)
          const today = isToday(d)
          return (
            <div
              key={d.toISOString()}
              className={`flex min-h-[72px] flex-col border-t border-[var(--color-border)] bg-[var(--color-bg)] p-1 md:min-h-[100px] ${
                !inMonth ? 'opacity-50' : ''
              } ${today ? 'ring-1 ring-inset ring-[var(--color-accent)]/40' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelectDayForRequest(d)}
                className="flex w-full items-start justify-start rounded-md px-0.5 py-0.5 text-left transition-colors hover:bg-[var(--color-surface)]"
                aria-label={`Request session for ${format(d, 'EEEE, MMMM d')}`}
              >
                <span
                  className={`flex h-7 min-w-[28px] items-center justify-center rounded-full text-[13px] font-medium ${
                    today ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-ink)]'
                  }`}
                >
                  {format(d, 'd')}
                </span>
              </button>
              <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {daySessions.slice(0, 3).map((s) => {
                  const t = parseISO(s.start_time ?? s.scheduled_time)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectSession(s)
                      }}
                      className="w-full truncate rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent-light)] px-1 py-0.5 text-left text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 md:text-[11px]"
                    >
                      {format(t, 'h:mm a')}
                      {s.type ? ` · ${s.type}` : ''}
                    </button>
                  )
                })}
                {daySessions.length > 3 ? (
                  <span className="text-[10px] text-[var(--color-muted)]">+{daySessions.length - 3} more</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
