'use client'

import Link from 'next/link'
import { addDays, addMinutes, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatCents } from '@/lib/format-currency'
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
import { labelForTimeValue } from './sessionFormOptions'

export type SessionRow = SessionForDrawer

export type DashboardStats = {
  activeClientsCount: number
  sessionsThisWeek: number
  revenueMonthCents: number
  revenuePrevMonthCents: number
  pendingInvoicesCount: number
  trends: {
    sessionsThisWeek: { direction: string; percentChange: number }
    revenueMonth: { direction: string; percentChange: number }
    activeClients: { direction: string; percentChange: number }
  }
}

export type AttentionData = {
  inactive: Array<{ clientId: string; firstName: string | null; lastName: string | null; lastMessageAt: string | null }>
  overdue: Array<{ id: string; dueAt: string; clientId: string; templateTitle: string | null; firstName: string | null; lastName: string | null }>
  unpaidInvoices: Array<{ id: string; amountCents: number; firstName: string | null; lastName: string | null }>
}

type ScheduleTodayPanelProps = {
  focusDay: Date
  sessions: SessionRow[]
  rules: AvailabilityRule[]
  now: Date
  dashStats: DashboardStats | null
  attention: AttentionData | null
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

function trendArrow(direction: string): string {
  if (direction === 'up') return '\u2191'
  if (direction === 'down') return '\u2193'
  return ''
}

function trendColor(direction: string): string {
  if (direction === 'up') return 'text-[var(--success)]'
  if (direction === 'down') return 'text-[var(--error)]'
  return 'text-[var(--text-tertiary)]'
}

export function ScheduleTodayPanel({
  focusDay,
  sessions,
  rules,
  now,
  dashStats,
  attention,
  onSessionClick,
  onBookSession,
  onEditAvailability,
  onViewFullSchedule,
}: ScheduleTodayPanelProps) {
  const daySessions = sessionsForDay(sessions, focusDay)
  const dow = dateToRuleDayOfWeek(focusDay)
  const dayRules = rules.filter((r) => r.day_of_week === dow)

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

  // Sessions after today's ones — for "Later" section
  const laterSessions = isFocusToday
    ? daySessions.filter((s) => {
        if (highlight?.session.id === s.id) return false
        return parseISO(s.scheduled_time) > now
      })
    : daySessions.filter((s) => highlight?.session.id !== s.id)

  // Attention items count
  const attentionCount = (attention?.inactive?.length ?? 0) + (attention?.overdue?.length ?? 0) + (attention?.unpaidInvoices?.length ?? 0)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--bg-subtle)] p-4">
      {/* Header */}
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{format(focusDay, 'EEEE')}</p>
        <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">{format(focusDay, 'MMMM d')}</p>
        <p className={cn('mt-1 text-[13px]', daySessions.length ? 'font-medium text-[var(--accent)]' : 'text-[var(--text-tertiary)]')}>
          {daySessions.length
            ? `${daySessions.length} session${daySessions.length === 1 ? '' : 's'}${isFocusToday ? ' today' : ` on ${format(focusDay, 'MMM d')}`}`
            : 'No sessions today'}
        </p>
      </div>

      {/* ── NEXT UP hero card ── */}
      {highlight ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            {highlight.kind === 'in-progress' ? 'In progress' : 'Next up'}
          </p>
          <button
            type="button"
            onClick={() => onSessionClick(highlight.session)}
            className={cn(
              'relative w-full rounded-[var(--radius-lg)] border bg-[var(--bg-app)] p-4 text-left transition-all duration-300 hover:-translate-y-0.5',
              highlight.kind === 'in-progress'
                ? 'border-[var(--success)] shadow-[0_0_20px_rgba(52,211,153,0.12)]'
                : 'border-[var(--accent)] shadow-[0_0_20px_rgba(159,18,57,0.12)]'
            )}
          >
            <span className={cn(
              'absolute top-3 right-3 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white',
              highlight.kind === 'in-progress' ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'
            )}>
              {highlight.kind === 'in-progress' ? 'Live' : 'Next'}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[24px] font-bold tabular-nums text-[var(--text-primary)]">
                {format(parseISO(highlight.session.scheduled_time), 'h:mm')}
              </span>
              <span className="text-[13px] font-medium text-[var(--text-tertiary)]">
                {format(parseISO(highlight.session.scheduled_time), 'a')}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ backgroundColor: clientColorForId(highlight.session.client_id) }}
              >
                {initials(fullName(highlight.session.clients ?? { first_name: null, last_name: null }))}
              </span>
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                {fullName(highlight.session.clients ?? { first_name: null, last_name: null })}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
              <span>{highlight.session.duration_minutes ?? 60} min</span>
              <span>&middot;</span>
              <span>{sessionTypeLabel(highlight.session.session_type)}</span>
            </div>
            {highlight.session.notes?.trim() && (
              <p className="mt-2 truncate text-[12px] italic text-[var(--text-quaternary)]">{highlight.session.notes}</p>
            )}
          </button>
        </div>
      ) : null}

      {/* ── Later today ── */}
      {laterSessions.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            {isFocusToday ? 'Later today' : 'Other sessions'}
          </p>
          <ul className="space-y-1.5">
            {laterSessions.map((s) => {
              const start = parseISO(s.scheduled_time)
              const name = fullName(s.clients ?? { first_name: null, last_name: null })
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSessionClick(s)}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-muted)]"
                  >
                    <span className="w-[52px] shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text-tertiary)]">
                      {format(start, 'h:mm a')}
                    </span>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: clientColorForId(s.client_id) }}
                    >
                      {initials(name).charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* ── No sessions empty state ── */}
      {daySessions.length === 0 ? (
        <div className="mb-4 flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-muted)] text-2xl" aria-hidden>
            📅
          </span>
          <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">No sessions {isFocusToday ? 'today' : 'this day'}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={onBookSession}>
            Book a session
          </Button>
        </div>
      ) : null}

      {/* ── Quick Stats ── */}
      {dashStats ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">This week</p>
          <div className="grid grid-cols-3 gap-2">
            {/* Sessions */}
            <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">Sessions</p>
              <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{dashStats.sessionsThisWeek}</p>
              {dashStats.trends.sessionsThisWeek.percentChange > 0 ? (
                <p className={cn('mt-1 text-[10px] font-medium', trendColor(dashStats.trends.sessionsThisWeek.direction))}>
                  {trendArrow(dashStats.trends.sessionsThisWeek.direction)} {Math.round(dashStats.trends.sessionsThisWeek.percentChange)}%
                </p>
              ) : <p className="mt-1 text-[10px] text-[var(--text-quaternary)]">this week</p>}
            </div>
            {/* Revenue */}
            <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">Revenue</p>
              <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{formatCents(dashStats.revenueMonthCents)}</p>
              <p className="mt-1 text-[10px] text-[var(--text-quaternary)]">this month</p>
            </div>
            {/* Clients */}
            <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">Clients</p>
              <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{dashStats.activeClientsCount}</p>
              <p className="mt-1 text-[10px] text-[var(--text-quaternary)]">active</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Needs Attention ── */}
      {attentionCount > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            Needs attention
          </p>
          <div className="space-y-1.5">
            {/* Inactive clients */}
            {attention?.inactive?.map((c) => (
              <Link
                key={c.clientId}
                href={`/coach/clients/${c.clientId}`}
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-[13px] transition-colors hover:bg-[var(--error-bg)]/80"
              >
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-[var(--error)]" />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client'}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">no reply 7d+</span>
              </Link>
            ))}
            {/* Overdue assignments */}
            {attention?.overdue?.map((a) => (
              <Link
                key={a.id}
                href={`/coach/clients/${a.clientId}`}
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[13px] transition-colors hover:bg-[var(--warning-bg)]/80"
              >
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-[var(--warning)]" />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                  {[a.firstName, a.lastName].filter(Boolean).join(' ') || 'Client'}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">task overdue</span>
              </Link>
            ))}
            {/* Unpaid invoices */}
            {attention?.unpaidInvoices?.map((inv) => (
              <Link
                key={inv.id}
                href="/coach/payments"
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[13px] transition-colors hover:bg-[var(--warning-bg)]/80"
              >
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-[var(--warning)]" />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                  {[inv.firstName, inv.lastName].filter(Boolean).join(' ') || 'Client'}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{formatCents(inv.amountCents)} unpaid</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Availability ── */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">My availability</p>
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
                {labelForTimeValue(r.start_time.slice(0, 5))} – {labelForTimeValue(r.end_time.slice(0, 5))}
                {r.label ? ` · ${r.label}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" className="mt-3 w-full text-[13px]" onClick={onEditAvailability}>
        Edit availability
      </Button>

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
