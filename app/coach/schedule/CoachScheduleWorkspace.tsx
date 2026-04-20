'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatCents } from '@/lib/format-currency'
import {
  addDays,
  addMonths,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { BookSessionModal } from './BookSessionModal'
import { AddAvailabilityModal } from './AddAvailabilityModal'
import type { SessionForDrawer } from './SessionDetailDrawer'
import { SessionDetailDrawer } from './SessionDetailDrawer'
import { ScheduleTodayPanel } from './ScheduleTodayPanel'
import type { DashboardStats, AttentionData } from './ScheduleTodayPanel'
import { ScheduleWeekGrid } from './ScheduleWeekGrid'
import { clientColorForId, fullName, type AvailabilityRule } from './schedule-lib'

type CalendarView = 'week' | 'month' | 'agenda'
type MobileTab = 'today' | 'week' | 'agenda'
type Toast = { id: number; text: string; type: 'success' | 'error' | 'warning' }

type SessionRow = SessionForDrawer

const GRID_START_HOUR = 7
const GRID_END_HOUR = 20

function toastStyle(type: Toast['type']): string {
  if (type === 'success') return 'bg-[var(--color-success-light)] text-[var(--color-success)]'
  if (type === 'warning') return 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
  return 'bg-[var(--color-error-light)] text-[var(--color-error)]'
}

export function CoachScheduleWorkspace() {
  const searchParams = useSearchParams()

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [detailSession, setDetailSession] = useState<SessionRow | null>(null)

  const [desktopView, setDesktopView] = useState<CalendarView>('week')
  const [mobileTab, setMobileTab] = useState<MobileTab>('today')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [monthDate, setMonthDate] = useState(new Date())
  const [panelDay, setPanelDay] = useState(() => startOfDay(new Date()))
  const [mobileAnchor, setMobileAnchor] = useState(() => startOfDay(new Date()))
  const [nowTick, setNowTick] = useState(() => new Date())

  const [modalOpen, setModalOpen] = useState(false)
  const [modalClientId, setModalClientId] = useState<string | null>(null)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalTime, setModalTime] = useState<string | null>(null)
  const [rescheduleFromSessionId, setRescheduleFromSessionId] = useState<string | null>(null)
  const [modalInitialDurationMinutes, setModalInitialDurationMinutes] = useState<number | null>(null)

  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [calendarSubscribeUrl, setCalendarSubscribeUrl] = useState<string | null>(null)
  const [calendarUrlLoading, setCalendarUrlLoading] = useState(true)

  const [dashStats, setDashStats] = useState<DashboardStats | null>(null)
  const [attention, setAttention] = useState<AttentionData | null>(null)

  const sessionFetchRange = useMemo(() => {
    if (desktopView === 'week' || desktopView === 'agenda') {
      return {
        from: startOfDay(weekStart).toISOString(),
        to: endOfDay(addDays(weekStart, 13)).toISOString(),
      }
    }
    const gridStart = startOfWeek(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), { weekStartsOn: 1 })
    return {
      from: startOfDay(gridStart).toISOString(),
      to: endOfDay(addDays(gridStart, 41)).toISOString(),
    }
  }, [desktopView, weekStart, monthDate])

  const addToast = (text: string, type: Toast['type'] = 'success') => {
    const item: Toast = { id: Date.now() + Math.random(), text, type }
    setToasts((prev) => [...prev, item])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), 4000)
  }

  const load = useCallback(async () => {
    setCalendarLoading(true)
    try {
      const params = new URLSearchParams({
        from: sessionFetchRange.from,
        to: sessionFetchRange.to,
      })
      const [sessionsRes, availabilityRes] = await Promise.all([
        fetch(`/api/coach/sessions?${params}`),
        fetch('/api/availability'),
      ])
      const sessionsJson = await sessionsRes.json()
      const availabilityJson = await availabilityRes.json()

      if (sessionsRes.ok) setSessions(sessionsJson.data ?? [])
      if (availabilityRes.ok) setRules((availabilityJson.data ?? []).filter((r: AvailabilityRule) => r.is_active))
    } finally {
      setCalendarLoading(false)
    }
  }, [sessionFetchRange.from, sessionFetchRange.to])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // Fetch dashboard stats + attention data
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch('/api/coach/dashboard-summary', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/coach/dashboard-attention', { credentials: 'include', cache: 'no-store' }),
    ]).then(async ([summaryRes, attentionRes]) => {
      if (cancelled) return
      if (summaryRes.ok) {
        const j = (await summaryRes.json().catch(() => ({}))) as { data?: DashboardStats }
        if (j.data) setDashStats(j.data)
      }
      if (attentionRes.ok) {
        const j = (await attentionRes.json().catch(() => ({}))) as { data?: AttentionData }
        if (j.data) setAttention(j.data)
      }
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/coach/calendar-feed-token', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { data?: { url?: string } }
        if (!cancelled && r.ok && typeof j.data?.url === 'string') {
          setCalendarSubscribeUrl(j.data.url)
        }
      })
      .catch(() => {
        if (!cancelled) setCalendarSubscribeUrl(null)
      })
      .finally(() => {
        if (!cancelled) setCalendarUrlLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const sessionId = searchParams.get('session')
    if (!sessionId || !sessions.length) return
    const found = sessions.find((s) => s.id === sessionId)
    if (found) setDetailSession(found)
  }, [searchParams, sessions])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const mobileWeekDays = useMemo(
    () => [addDays(mobileAnchor, -1), mobileAnchor, addDays(mobileAnchor, 1)],
    [mobileAnchor]
  )

  const agendaGroups = useMemo(() => {
    const map = new Map<string, SessionRow[]>()
    for (const s of sessions) {
      const k = format(parseISO(s.scheduled_time), 'yyyy-MM-dd')
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(s)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({
        date,
        list: list.sort((x, y) => parseISO(x.scheduled_time).getTime() - parseISO(y.scheduled_time).getTime()),
      }))
  }, [sessions])

  const monthGridStart = startOfWeek(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), { weekStartsOn: 1 })
  const monthCells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)), [monthGridStart])

  const openBookModal = (date: string | null, time: string | null, clientId?: string | null) => {
    setRescheduleFromSessionId(null)
    setModalInitialDurationMinutes(null)
    setModalDate(date)
    setModalTime(time)
    setModalClientId(clientId ?? null)
    setModalOpen(true)
  }

  const goToday = () => {
    const t = new Date()
    setWeekStart(startOfWeek(t, { weekStartsOn: 1 }))
    setMonthDate(t)
    setPanelDay(startOfDay(t))
    setMobileAnchor(startOfDay(t))
  }

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))

  const headerDatePill = format(new Date(), 'EEEE, MMMM d')

  const attentionCount = (attention?.inactive?.length ?? 0) + (attention?.overdue?.length ?? 0) + (attention?.unpaidInvoices?.length ?? 0)

  return (
    <div className="sensei-page">

      {/* ── Header: label + date nav + actions ── */}
      <header className="mb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="sensei-page__label">Command Center</p>
            <h2 className="sensei-page__heading mt-1">{headerDatePill}</h2>
          </div>
          <button
            type="button"
            className="sensei-page__action-btn"
            onClick={() => openBookModal(null, null)}
          >
            Book Session
          </button>
        </div>

        {/* ── Quick Stats — always visible at top ── */}
        {dashStats && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">Sessions</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{dashStats.sessionsThisWeek}</p>
              {dashStats.trends.sessionsThisWeek.percentChange > 0 ? (
                <p className={cn('mt-1 text-[11px] font-medium', dashStats.trends.sessionsThisWeek.direction === 'up' ? 'text-[var(--success)]' : dashStats.trends.sessionsThisWeek.direction === 'down' ? 'text-[var(--error)]' : 'text-[var(--text-tertiary)]')}>
                  {dashStats.trends.sessionsThisWeek.direction === 'up' ? '↑' : '↓'} {Math.round(dashStats.trends.sessionsThisWeek.percentChange)}% vs last week
                </p>
              ) : <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">this week</p>}
            </div>
            <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">Revenue</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{formatCents(dashStats.revenueMonthCents)}</p>
              <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">this month</p>
            </div>
            <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">Clients</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{dashStats.activeClientsCount}</p>
              <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">active</p>
            </div>
            <div className={cn('card-glow rounded-[var(--radius-lg)] border bg-[var(--bg-subtle)] p-4', attentionCount > 0 ? 'border-[var(--warning-border)]' : 'border-[var(--border-subtle)]')}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">Attention</p>
              <p className={cn('mt-1 text-[28px] font-bold tabular-nums leading-none', attentionCount > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]')}>{attentionCount}</p>
              <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">{attentionCount > 0 ? 'needs action' : 'all clear'}</p>
            </div>
          </div>
        )}

        {/* Navigation + view toggle */}
        <div className="sensei-page__toolbar mt-5">
          <button
            type="button"
            className="sensei-page__nav-btn"
            aria-label="Previous"
            onClick={() => {
              if (desktopView === 'week') setWeekStart((d) => addDays(d, -7))
              else if (desktopView === 'month') setMonthDate((d) => addMonths(d, -1))
              else setWeekStart((d) => addDays(d, -7))
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            className={cn(
              'sensei-page__toggle-btn rounded-lg border border-[var(--border-default)]',
              isCurrentWeek ? 'opacity-40' : 'sensei-page__toggle-btn--active'
            )}
            onClick={goToday}
          >
            Today
          </button>

          <button
            type="button"
            className="sensei-page__nav-btn"
            aria-label="Next"
            onClick={() => {
              if (desktopView === 'week') setWeekStart((d) => addDays(d, 7))
              else if (desktopView === 'month') setMonthDate((d) => addMonths(d, 1))
              else setWeekStart((d) => addDays(d, 7))
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <span className="sensei-page__date-range ml-1">
            {desktopView === 'month'
              ? format(monthDate, 'MMMM yyyy')
              : `${format(weekStart, 'MMM d')} \u2014 ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`}
          </span>

          <div className="ml-auto hidden lg:block">
            <div className="sensei-page__toggle-group">
              {(['week', 'month', 'agenda'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={cn('sensei-page__toggle-btn', desktopView === v && 'sensei-page__toggle-btn--active')}
                  onClick={() => setDesktopView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile tabs ── */}
      <div className="sensei-page__tabs lg:hidden">
        {(['today', 'week', 'agenda'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn('sensei-page__tab', mobileTab === tab && 'sensei-page__tab--active')}
            onClick={() => setMobileTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Calendar subscribe ── */}
      <details className="sensei-page__collapsible">
        <summary>
          Subscribe in Google Calendar or Apple Calendar
          <span className="ml-2 text-[11px] text-[var(--text-quaternary)]">(optional)</span>
        </summary>
        <div className="sensei-page__collapsible-body">
          {calendarUrlLoading ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">Loading subscribe link&hellip;</p>
          ) : calendarSubscribeUrl ? (
            <>
              <p className="text-[13px] leading-relaxed text-[var(--text-tertiary)]">
                Paste the URL below in Google Calendar &rarr; <em>From URL</em>. Treat the link like a password.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={calendarSubscribeUrl}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]"
                  aria-label="Calendar subscribe URL"
                />
                <button
                  type="button"
                  className="sensei-page__action-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(calendarSubscribeUrl).then(() => {
                      addToast('Calendar link copied', 'success')
                    })
                  }}
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-[12px] text-[var(--text-quaternary)]">
                Next 90 days of sessions.{' '}
                <a href="/api/calendar/feed/coach" className="font-medium text-[var(--accent-dark)] hover:text-[var(--accent)]">
                  Download .ics
                </a>
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)]">
              Could not load a subscribe link.{' '}
              <a href="/api/calendar/feed/coach" className="font-medium text-[var(--accent-dark)] hover:text-[var(--accent)]">
                Download .ics
              </a>
            </p>
          )}
        </div>
      </details>

      {/* ── Quick Actions Row ── */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <button type="button" onClick={() => openBookModal(null, null)} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-3 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(159,18,57,0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <span className="text-[18px]">📅</span>
          Book Session
        </button>
        <Link href="/coach/clients" className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-3 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(159,18,57,0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <span className="text-[18px]">👤</span>
          Clients
        </Link>
        <Link href="/coach/videos" className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-3 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(159,18,57,0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <span className="text-[18px]">📹</span>
          Videos
        </Link>
        <Link href="/coach/programs" className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-3 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(159,18,57,0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <span className="text-[18px]">📋</span>
          Programs
        </Link>
        <Link href="/coach/payments" className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-3 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(159,18,57,0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <span className="text-[18px]">💰</span>
          Payments
        </Link>
        <button type="button" onClick={() => setAvailabilityOpen(true)} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-3 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(159,18,57,0.2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]">
          <span className="text-[18px]">⚙️</span>
          Availability
        </button>
      </div>

      {/* ── Empty state ── */}
      {!calendarLoading && sessions.length === 0 && (
        <div className="sensei-page__empty mt-6">
          <CalendarDays className="h-10 w-10 text-[var(--accent-dark)]" strokeWidth={1} />
          <p className="sensei-page__empty-title">No sessions this week</p>
          <p className="sensei-page__empty-sub">
            Book your first session or set your availability so clients know when you&apos;re free.
          </p>
          <div className="mt-6 flex gap-3">
            <button type="button" className="sensei-page__action-btn" onClick={() => openBookModal(null, null)}>
              Book Session
            </button>
            <button
              type="button"
              className="sensei-page__toggle-btn rounded-lg border border-[var(--border-default)] px-4"
              onClick={() => setAvailabilityOpen(true)}
            >
              Set Availability
            </button>
          </div>
        </div>
      )}

      {/* ── Main content: sidebar + calendar grid ── */}
      <div className="mt-4 flex min-h-0 flex-1 gap-0 lg:mt-6">

        {/* Left panel — today focus */}
        <aside className="hidden w-[280px] shrink-0 overflow-hidden rounded-l-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] lg:block">
          <ScheduleTodayPanel
            focusDay={panelDay}
            sessions={sessions}
            rules={rules}
            now={nowTick}
            dashStats={dashStats}
            attention={attention}
            onSessionClick={(s) => setDetailSession(s)}
            onBookSession={() => openBookModal(null, null)}
            onEditAvailability={() => setAvailabilityOpen(true)}
            onViewFullSchedule={() => {
              const el = document.getElementById('coach-schedule-main')
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        </aside>

        {/* Right — calendar views */}
        <section
          id="coach-schedule-main"
          className="relative flex min-h-[480px] min-w-0 flex-1 flex-col scroll-mt-4 lg:min-h-[560px]"
        >
          {/* Desktop views */}
          <div className="hidden min-h-0 flex-1 flex-col lg:flex">
            {calendarLoading ? (
              <div className="h-[520px] animate-pulse rounded-r-xl bg-[var(--bg-subtle)]" />
            ) : (
              <ErrorBoundary
                fallback={
                  <div className="sensei-page__card px-6 py-10 text-center">
                    <p className="font-medium text-[var(--text-primary)]">Calendar could not be displayed</p>
                    <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">Try again or refresh the page.</p>
                  </div>
                }
              >
                {desktopView === 'week' && (
                  <ScheduleWeekGrid
                    weekDays={weekDays}
                    sessions={sessions}
                    rules={rules}
                    startHour={GRID_START_HOUR}
                    endHour={GRID_END_HOUR}
                    now={nowTick}
                    onBookSlot={(d, t) => openBookModal(d, t)}
                    onOpenSession={setDetailSession}
                  />
                )}

                {desktopView === 'month' && (
                  <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--border-subtle)]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => (
                      <div
                        key={name}
                        className="sensei-page__label bg-[var(--bg-subtle)] py-2.5 text-center"
                      >
                        {name}
                      </div>
                    ))}
                    {monthCells.map((day) => {
                      const daySessions = sessions.filter((s) => isSameDay(parseISO(s.scheduled_time), day))
                      const inMonth = isSameMonth(day, monthDate)
                      const today = isSameDay(day, new Date())
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          className={cn(
                            'flex min-h-[88px] flex-col bg-[var(--bg-subtle)] p-2 text-left transition-colors hover:bg-[var(--bg-muted)]',
                            !inMonth && 'opacity-30',
                            today && 'ring-1 ring-inset ring-[var(--accent)]'
                          )}
                          onClick={() => {
                            setWeekStart(startOfWeek(day, { weekStartsOn: 1 }))
                            setPanelDay(startOfDay(day))
                            setDesktopView('week')
                          }}
                        >
                          <span
                            className={cn(
                              'self-end text-[14px] font-medium tabular-nums',
                              today
                                ? 'flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] text-[var(--text-on-accent)]'
                                : 'text-[var(--text-primary)]'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          <div className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-hidden">
                            {daySessions.slice(0, 2).map((s) => {
                              const name = fullName(s.clients ?? { first_name: null, last_name: null })
                              const c = clientColorForId(s.client_id)
                              return (
                                <div
                                  key={s.id}
                                  className="truncate rounded px-1 py-0.5 text-[11px] font-medium text-[var(--text-primary)]"
                                  style={{ backgroundColor: `${c}33` }}
                                >
                                  {name}
                                </div>
                              )
                            })}
                            {daySessions.length > 2 && (
                              <span className="text-[11px] font-medium text-[var(--accent-dark)]">
                                +{daySessions.length - 2} more
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {desktopView === 'agenda' && (
                  <div className="space-y-6 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
                    {agendaGroups.length === 0 ? (
                      <p className="text-[14px] text-[var(--text-tertiary)]">No upcoming sessions in this range.</p>
                    ) : (
                      agendaGroups.map(({ date, list }) => {
                        const d0 = parseISO(`${date}T12:00:00`)
                        const label =
                          isSameDay(d0, new Date()) ? `Today \u2014 ${format(d0, 'EEEE, MMMM d')}` : format(d0, 'EEEE, MMMM d')
                        return (
                          <div key={date}>
                            <h3 className="sensei-page__label mb-3">{label}</h3>
                            <ul className="space-y-2">
                              {list.map((s) => {
                                const st = parseISO(s.scheduled_time)
                                const name = fullName(s.clients ?? { first_name: null, last_name: null })
                                const c = clientColorForId(s.client_id)
                                return (
                                  <li key={s.id}>
                                    <button
                                      type="button"
                                      className="sensei-page__card flex w-full items-start gap-4 text-left"
                                      onClick={() => setDetailSession(s)}
                                    >
                                      <span className="w-[72px] shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                                        {format(st, 'h:mm a')}
                                      </span>
                                      <span
                                        className="mt-1 h-8 w-0.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: c }}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{name}</p>
                                        <p className="text-[12px] text-[var(--text-tertiary)]">
                                          {s.duration_minutes ?? 60} min &middot; {s.session_type?.trim() || 'Video'}
                                        </p>
                                        {s.notes?.trim() && (
                                          <p className="mt-1 truncate text-[12px] italic text-[var(--text-quaternary)]">{s.notes}</p>
                                        )}
                                      </div>
                                      <Badge
                                        variant={
                                          s.status === 'confirmed' ? 'active' : s.status === 'completed' ? 'inactive' : 'pending'
                                        }
                                      >
                                        {s.status}
                                      </Badge>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </ErrorBoundary>
            )}
          </div>

          {/* Mobile: Today panel */}
          <div className={cn('flex min-h-[420px] flex-col lg:hidden', mobileTab === 'today' ? 'flex' : 'hidden')}>
            <ScheduleTodayPanel
              focusDay={panelDay}
              sessions={sessions}
              rules={rules}
              now={nowTick}
              dashStats={dashStats}
              attention={attention}
              onSessionClick={(s) => setDetailSession(s)}
              onBookSession={() => openBookModal(null, null)}
              onEditAvailability={() => setAvailabilityOpen(true)}
              onViewFullSchedule={() => setMobileTab('week')}
            />
          </div>

          {/* Mobile: Week grid */}
          <div className={cn('min-h-0 flex-1 flex-col pb-4 lg:hidden', mobileTab === 'week' ? 'flex' : 'hidden')}>
            <div className="my-3 flex items-center justify-between">
              <button
                type="button"
                className="sensei-page__nav-btn"
                aria-label="Previous days"
                onClick={() => setMobileAnchor((d) => addDays(d, -1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="sensei-page__label">3-day view</span>
              <button
                type="button"
                className="sensei-page__nav-btn"
                aria-label="Next days"
                onClick={() => setMobileAnchor((d) => addDays(d, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {calendarLoading ? (
              <div className="h-[400px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
            ) : (
              <ScheduleWeekGrid
                weekDays={mobileWeekDays}
                sessions={sessions}
                rules={rules}
                startHour={GRID_START_HOUR}
                endHour={GRID_END_HOUR}
                now={nowTick}
                onBookSlot={(d, t) => openBookModal(d, t)}
                onOpenSession={setDetailSession}
              />
            )}
          </div>

          {/* Mobile: Agenda */}
          <div className={cn('min-h-0 flex-1 lg:hidden', mobileTab === 'agenda' ? 'block' : 'hidden')}>
            <div className="mt-3 max-h-[70vh] space-y-6 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              {agendaGroups.length === 0 ? (
                <p className="text-[14px] text-[var(--text-tertiary)]">No upcoming sessions.</p>
              ) : (
                agendaGroups.map(({ date, list }) => {
                  const d0 = parseISO(`${date}T12:00:00`)
                  const label =
                    isSameDay(d0, new Date()) ? `Today \u2014 ${format(d0, 'EEEE, MMMM d')}` : format(d0, 'EEEE, MMMM d')
                  return (
                    <div key={date}>
                      <h3 className="sensei-page__label mb-3">{label}</h3>
                      <ul className="space-y-2">
                        {list.map((s) => {
                          const st = parseISO(s.scheduled_time)
                          const name = fullName(s.clients ?? { first_name: null, last_name: null })
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                className="sensei-page__card flex w-full flex-col text-left"
                                onClick={() => setDetailSession(s)}
                              >
                                <span className="text-[13px] font-semibold text-[var(--accent-dark)]">{format(st, 'h:mm a')}</span>
                                <span className="mt-1 text-[14px] font-medium text-[var(--text-primary)]">{name}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

        {/* Session detail drawer */}
        {detailSession && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
              aria-label="Close session details"
              onClick={() => setDetailSession(null)}
            />
            <div
              className={cn(
                'z-50 flex flex-col border-[var(--border-default)] bg-[var(--bg-subtle)] shadow-[var(--shadow-xl)]',
                'fixed inset-x-0 bottom-0 max-h-[90vh] rounded-t-xl border-t',
                'lg:absolute lg:inset-x-auto lg:top-0 lg:right-0 lg:bottom-0 lg:h-full lg:max-h-none lg:w-[320px] lg:rounded-none lg:rounded-r-xl lg:border-t-0 lg:border-l'
              )}
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <SessionDetailDrawer
                session={detailSession}
                onClose={() => setDetailSession(null)}
                onUpdated={load}
                onToast={addToast}
                onReschedule={() => {
                  setRescheduleFromSessionId(detailSession.id)
                  setModalClientId(detailSession.client_id)
                  setModalInitialDurationMinutes(detailSession.duration_minutes ?? 60)
                  setModalDate(null)
                  setModalTime(null)
                  setDetailSession(null)
                  setModalOpen(true)
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <BookSessionModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setRescheduleFromSessionId(null)
          setModalInitialDurationMinutes(null)
        }}
        onBooked={load}
        initialClientId={modalClientId}
        initialDate={modalDate}
        initialTime={modalTime}
        rescheduleFromSessionId={rescheduleFromSessionId}
        initialDurationMinutes={modalInitialDurationMinutes}
      />

      <AddAvailabilityModal
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        onSaved={() => {
          load()
          void fetch('/api/availability/materialize', { method: 'POST' }).then(() => load())
        }}
      />

      {/* Mobile FAB */}
      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--shadow-xl)] lg:bottom-8 lg:hidden"
        style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
        aria-label="Book session"
        onClick={() => openBookModal(null, null)}
      >
        <span className="text-2xl leading-none">+</span>
      </button>

      {/* Toast notifications */}
      <div className="fixed right-4 top-20 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'rounded-lg px-4 py-2.5 text-[13px] font-medium shadow-lg',
              toastStyle(toast.type)
            )}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}
