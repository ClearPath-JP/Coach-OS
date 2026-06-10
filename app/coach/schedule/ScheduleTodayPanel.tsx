'use client'

import Link from 'next/link'
import { addDays, addMinutes, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Calendar, ClipboardList, DollarSign, Users, Video } from 'lucide-react'
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
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{format(focusDay, 'EEEE')}</p>
        <p className="font-[family-name:var(--font-display)] text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">{format(focusDay, 'MMMM d')}</p>
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
            className="arcade-tile arcade-lift relative w-full bg-[var(--bg-app)] p-4 text-left"
          >
            <span className={cn(
              'arcade-badge absolute top-3 right-3',
              highlight.kind === 'in-progress' ? 'arcade-badge-teal' : 'arcade-badge-yellow'
            )}>
              {highlight.kind === 'in-progress' ? 'Live' : 'Next'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-display)] text-[26px] font-extrabold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">
                {format(parseISO(highlight.session.scheduled_time), 'h:mm')}
              </span>
              <span className="text-[13px] font-bold text-[var(--text-tertiary)]">
                {format(parseISO(highlight.session.scheduled_time), 'a')}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--ink)] text-[12px] font-bold text-white shadow-[2px_2px_0_var(--ink)]"
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
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--accent)]" aria-hidden>
            <Calendar size={22} />
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
            <div className="tile-yellow p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ink)]/65">Sessions</p>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-[22px] font-extrabold tabular-nums leading-none tracking-[-0.03em] text-[var(--ink)]">{dashStats.sessionsThisWeek}</p>
              {dashStats.trends?.sessionsThisWeek?.percentChange != null && dashStats.trends.sessionsThisWeek.percentChange > 0 ? (
                <p className={cn('mt-1 text-[10px] font-bold', trendColor(dashStats.trends.sessionsThisWeek.direction))}>
                  {trendArrow(dashStats.trends.sessionsThisWeek.direction)} {Math.round(dashStats.trends.sessionsThisWeek.percentChange)}%
                </p>
              ) : <p className="mt-1 text-[10px] font-medium text-[var(--ink)]/55">this week</p>}
            </div>
            {/* Revenue */}
            <div className="tile-teal p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/65">Revenue</p>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-[22px] font-extrabold tabular-nums leading-none tracking-[-0.03em] text-white">{formatCents(dashStats.revenueMonthCents)}</p>
              <p className="mt-1 text-[10px] font-medium text-white/65">this month</p>
            </div>
            {/* Clients */}
            <div className="tile-violet p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ink)]/65">Clients</p>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-[22px] font-extrabold tabular-nums leading-none tracking-[-0.03em] text-[var(--ink)]">{dashStats.activeClientsCount}</p>
              <p className="mt-1 text-[10px] font-medium text-[var(--ink)]/55">active</p>
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

      {/* ── Quick Actions ── */}
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Quick actions</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/coach/clients"
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <Users size={14} /> Add Client
          </Link>
          <Link
            href="/coach/videos"
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <Video size={14} /> Upload Video
          </Link>
          <Link
            href="/coach/programs"
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <ClipboardList size={14} /> New Program
          </Link>
          <Link
            href="/coach/payments"
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <DollarSign size={14} /> Send Invoice
          </Link>
        </div>
      </div>

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
