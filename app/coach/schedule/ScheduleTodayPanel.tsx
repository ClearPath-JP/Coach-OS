'use client'

import { addDays, addMinutes, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { SessionForDrawer } from './SessionDetailDrawer'
import {
  clientColorForId,
  dateToRuleDayOfWeek,
  fullName,
  initials,
  sessionTypeAccentClass,
  sessionTypeLabel,
  type AvailabilityRule,
} from './schedule-lib'

export type SessionRow = SessionForDrawer

type ScheduleTodayPanelProps = {
  focusDay: Date
  sessions: SessionRow[]
  rules: AvailabilityRule[]
  now: Date
  onSessionClick: (s: SessionRow) => void
  onBookSession: () => void
  onEditAvailability: () => void
  onViewFullSchedule?: () => void
}

function sessionsForDay(sessions: SessionRow[], day: Date): SessionRow[] {
  const key = format(day, 'yyyy-MM-dd')
  return sessions
    .filter((s) => format(parseISO(s.scheduled_time), 'yyyy-MM-dd') === key)
    .sort((a, b) => parseISO(a.scheduled_time).getTime() - parseISO(b.scheduled_time).getTime())
}

export function ScheduleTodayPanel({
  focusDay,
  sessions,
  rules,
  now,
  onSessionClick,
  onBookSession,
  onEditAvailability,
  onViewFullSchedule,
}: ScheduleTodayPanelProps) {
  const daySessions = sessionsForDay(sessions, focusDay)
  const dow = dateToRuleDayOfWeek(focusDay)
  const dayRules = rules.filter((r) => r.day_of_week === dow)

  const comingUp = sessions
    .filter((s) => parseISO(s.scheduled_time) >= startOfDay(addDays(focusDay, 1)))
    .sort((a, b) => parseISO(a.scheduled_time).getTime() - parseISO(b.scheduled_time).getTime())
    .slice(0, 3)

  const isFocusToday = isSameDay(focusDay, now)

  const highlight = (() => {
    for (const s of daySessions) {
      const start = parseISO(s.scheduled_time)
      const end = s.end_time ? parseISO(s.end_time) : addMinutes(start, s.duration_minutes ?? 60)
      if (isFocusToday && now >= start && now < end) return { kind: 'in-progress' as const, session: s }
    }
    for (const s of daySessions) {
      const start = parseISO(s.scheduled_time)
      if (isFocusToday && start > now) return { kind: 'next' as const, session: s }
    }
    if (!isFocusToday && daySessions[0]) return { kind: 'next' as const, session: daySessions[0] }
    return null
  })()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg-subtle)] p-4">
      <div className="mb-4">
        <p className="text-[13px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{format(focusDay, 'EEEE')}</p>
        <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">{format(focusDay, 'MMMM d')}</p>
        <p className={cn('mt-1 text-[13px]', daySessions.length ? 'font-medium text-[var(--accent)]' : 'text-[var(--text-tertiary)]')}>
          {daySessions.length ? `${daySessions.length} session${daySessions.length === 1 ? '' : 's'}${isFocusToday ? ' today' : ` on ${format(focusDay, 'MMM d')}`}` : 'No sessions today'}
        </p>
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
        {isFocusToday ? 'Today' : format(focusDay, 'MMM d')}
      </p>
      {daySessions.length === 0 ? (
        <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-muted)] text-2xl" aria-hidden>
            📅
          </span>
          <p className="mt-3 text-[14px] text-[var(--text-tertiary)]">No sessions today</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={onBookSession}>
            Book a session
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {daySessions.map((s) => {
            const start = parseISO(s.scheduled_time)
            const name = fullName(s.clients ?? { first_name: null, last_name: null })
            const isNext = highlight?.kind === 'next' && highlight.session.id === s.id
            const inProgress = highlight?.kind === 'in-progress' && highlight.session.id === s.id
            const accent = sessionTypeAccentClass(s.session_type)

            return (
              <li key={s.id}>
                {isNext && isFocusToday ? (
                  <span className="mb-1 inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-white">
                    Next up
                  </span>
                ) : null}
                {inProgress && isFocusToday ? (
                  <span className="mb-1 inline-block rounded-full bg-[var(--success)] px-2 py-0.5 text-[11px] font-medium text-white">
                    In progress
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSessionClick(s)}
                  className={cn(
                    'relative w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] p-3 text-left transition-shadow hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]',
                    isNext && isFocusToday && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-subtle)]',
                    inProgress && isFocusToday && 'border-[var(--success)]'
                  )}
                >
                  <span className={cn('absolute top-2 bottom-2 left-0 w-1 rounded-l-[var(--radius-lg)]', accent)} />
                  <div className="pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{format(start, 'h:mm a')}</span>
                      <span className="text-[11px] text-[var(--text-tertiary)]">{s.duration_minutes ?? 60} min</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: clientColorForId(s.client_id) }}
                      >
                        {initials(name)}
                      </span>
                      <span className="truncate text-[14px] font-medium text-[var(--text-primary)]">{name}</span>
                    </div>
                    <span className="mt-2 inline-block rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                      {sessionTypeLabel(s.session_type)}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">My availability</p>
      {dayRules.length === 0 ? (
        <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 text-[13px] text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--warning)]">No availability set</p>
          <p className="mt-1 text-[12px] leading-snug">Set your hours so clients know when you&apos;re free.</p>
          <Button type="button" size="sm" className="mt-3" onClick={onEditAvailability}>
            Set availability
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {dayRules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success)]" />
              <span>
                {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                {r.label ? ` · ${r.label}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" className="mt-3 w-full text-[13px]" onClick={onEditAvailability}>
        Edit availability
      </Button>

      <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">Coming up</p>
      {comingUp.length === 0 ? (
        <p className="text-[13px] text-[var(--text-tertiary)]">Nothing scheduled in the next week.</p>
      ) : (
        <ul className="space-y-3">
          {comingUp.map((s) => {
            const st = parseISO(s.scheduled_time)
            const name = fullName(s.clients ?? { first_name: null, last_name: null })
            return (
              <li key={s.id}>
                <button type="button" className="w-full text-left" onClick={() => onSessionClick(s)}>
                  <div className="flex gap-3">
                    <div className="w-14 shrink-0">
                      <p className="text-[12px] text-[var(--text-tertiary)]">{format(st, 'EEE')}</p>
                      <p className="text-[12px] font-medium text-[var(--text-primary)]">{format(st, 'MMM d')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{format(st, 'h:mm a')}</p>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {onViewFullSchedule ? (
        <button
          type="button"
          onClick={onViewFullSchedule}
          className="mt-4 text-left text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          View full schedule →
        </button>
      ) : null}
    </div>
  )
}
