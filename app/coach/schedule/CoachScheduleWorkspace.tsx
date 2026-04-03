'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { BookSessionModal } from './BookSessionModal'
import { AddAvailabilityModal } from './AddAvailabilityModal'
import type { SessionForDrawer } from './SessionDetailDrawer'
import { SessionDetailDrawer } from './SessionDetailDrawer'
import { ScheduleTodayPanel } from './ScheduleTodayPanel'
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

  const headerDatePill = format(new Date(), 'EEEE, MMMM d')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 -mx-[var(--coach-content-px-mobile)] mb-[var(--coach-header-content-gap)] flex min-h-[var(--coach-header-height)] shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--cp-offwhite)] px-[var(--coach-content-px-mobile)] py-2 lg:-mx-[var(--coach-content-px)] lg:px-[var(--coach-content-px)] lg:py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">Schedule</h1>
          <span className="rounded-full bg-[var(--accent-light)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--cp-accent)]">
            {headerDatePill}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            aria-label="Previous"
            onClick={() => {
              if (desktopView === 'week') setWeekStart((d) => addDays(d, -7))
              else if (desktopView === 'month') setMonthDate((d) => addMonths(d, -1))
              else setWeekStart((d) => addDays(d, -7))
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button type="button" variant="secondary" className="h-8 px-3 text-[13px]" onClick={goToday}>
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            aria-label="Next"
            onClick={() => {
              if (desktopView === 'week') setWeekStart((d) => addDays(d, 7))
              else if (desktopView === 'month') setMonthDate((d) => addMonths(d, 1))
              else setWeekStart((d) => addDays(d, 7))
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span className="text-[14px] font-medium tabular-nums text-[var(--text-tertiary)]">
            {desktopView === 'month'
              ? format(monthDate, 'MMMM yyyy')
              : `${format(weekStart, 'MMM d')} — ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center rounded-lg border border-[var(--border-default)] lg:flex">
            {(['week', 'month', 'agenda'] as const).map((v, i, arr) => (
              <button
                key={v}
                type="button"
                onClick={() => setDesktopView(v)}
                className={cn(
                  'h-8 border-[var(--border-default)] px-3.5 text-[13px] font-medium capitalize',
                  i === 0 && 'rounded-l-lg border-r',
                  i === arr.length - 1 && 'rounded-r-lg border-l-0',
                  i > 0 && i < arr.length - 1 && 'border-r',
                  desktopView === v
                    ? 'bg-[var(--cp-accent)] text-[var(--text-on-accent)]'
                    : 'bg-[var(--cp-offwhite)] text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)]'
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="hidden h-6 w-px bg-[var(--border-default)] lg:block" aria-hidden />
          <Button type="button" className="h-9 px-4 text-[14px]" onClick={() => openBookModal(null, null)}>
            Book session
          </Button>
        </div>
      </header>

      <div className="sticky top-0 z-10 flex border-b border-[var(--border-subtle)] bg-[var(--cp-offwhite)] lg:hidden">
        {(['today', 'week', 'agenda'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn(
              'min-h-11 flex-1 border-b-2 py-3 text-[13px] font-medium capitalize',
              mobileTab === tab
                ? 'border-[var(--cp-accent)] text-[var(--cp-accent)]'
                : 'border-transparent text-[var(--text-tertiary)]'
            )}
            onClick={() => setMobileTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <details className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] text-sm open:shadow-sm">
        <summary className="cursor-pointer select-none list-none px-4 py-3 font-medium text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span>Subscribe in Google Calendar or Apple Calendar</span>
            <span className="text-[12px] font-normal text-[var(--text-tertiary)]">(optional)</span>
          </span>
        </summary>
        <div className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-3">
          {calendarUrlLoading ? (
            <p className="text-[var(--text-secondary)]">Loading your subscribe link…</p>
          ) : calendarSubscribeUrl ? (
            <>
              <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                Paste the URL below in Google Calendar → <em>From URL</em>. Treat the link like a password.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={calendarSubscribeUrl}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]"
                  aria-label="Calendar subscribe URL"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    void navigator.clipboard.writeText(calendarSubscribeUrl).then(() => {
                      addToast('Calendar link copied', 'success')
                    })
                  }}
                >
                  Copy link
                </Button>
              </div>
              <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                Next 90 days of sessions.{' '}
                <a href="/api/calendar/feed/coach" className="font-medium text-[var(--cp-accent)] hover:underline">
                  Download .ics
                </a>{' '}
                while signed in.
              </p>
            </>
          ) : (
            <p className="text-[var(--text-secondary)]">
              Could not load a subscribe link.{' '}
              <a href="/api/calendar/feed/coach" className="font-medium text-[var(--cp-accent)] hover:underline">
                Download .ics
              </a>{' '}
              while signed in.
            </p>
          )}
        </div>
      </details>

      {!calendarLoading && sessions.length === 0 && (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-8 text-center">
          <p className="text-3xl" aria-hidden>
            📅
          </p>
          <p className="mt-3 text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">No sessions this week</p>
          <p className="mx-auto mt-2 max-w-[440px] text-[var(--text-14)] leading-relaxed text-[var(--text-tertiary)]">
            Book your first session or set your availability so clients know when you&apos;re free.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" className="min-h-11" onClick={() => openBookModal(null, null)}>
              Book your first session
            </Button>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => setAvailabilityOpen(true)}>
              Set availability
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col gap-0 lg:mt-6 lg:flex-row lg:gap-0">
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--border-subtle)] lg:block lg:min-h-[560px]">
          <ScheduleTodayPanel
            focusDay={panelDay}
            sessions={sessions}
            rules={rules}
            now={nowTick}
            onSessionClick={(s) => setDetailSession(s)}
            onBookSession={() => openBookModal(null, null)}
            onEditAvailability={() => setAvailabilityOpen(true)}
            onViewFullSchedule={() => {
              const el = document.getElementById('coach-schedule-main')
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        </aside>

        <section
          id="coach-schedule-main"
          className="relative flex min-h-[480px] min-w-0 flex-1 flex-col scroll-mt-4 lg:min-h-[560px]"
        >
          <div className="min-h-0 flex-1 pb-24">
            <div className="hidden min-h-0 flex-1 flex-col lg:flex">
              {calendarLoading ? (
                <div className="h-[520px] animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
              ) : (
                <ErrorBoundary
                  fallback={
                    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-8 text-center text-[15px] text-[var(--text-tertiary)]">
                      <p className="font-medium text-[var(--text-primary)]">Calendar could not be displayed</p>
                      <p className="mt-1 text-[13px]">Try again or refresh the page.</p>
                    </div>
                  }
                >
                  {desktopView === 'week' ? (
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
                  ) : null}
                  {desktopView === 'month' ? (
                    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--border-subtle)]">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => (
                        <div
                          key={name}
                          className="bg-[var(--bg-subtle)] py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
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
                              'flex min-h-[88px] flex-col bg-[var(--cp-offwhite)] p-1.5 text-left transition-colors hover:bg-[var(--bg-subtle)]',
                              !inMonth && 'opacity-40',
                              today && 'ring-1 ring-inset ring-[var(--cp-accent)]'
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
                                today ? 'flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[13px] text-white' : 'text-[var(--text-primary)]'
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
                              {daySessions.length > 2 ? (
                                <span className="text-[11px] font-medium text-[var(--cp-accent)]">+{daySessions.length - 2} more</span>
                              ) : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                  {desktopView === 'agenda' ? (
                    <div className="space-y-6 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-4">
                      {agendaGroups.length === 0 ? (
                        <p className="text-[14px] text-[var(--text-tertiary)]">No upcoming sessions in this range.</p>
                      ) : (
                        agendaGroups.map(({ date, list }) => {
                          const d0 = parseISO(`${date}T12:00:00`)
                          const label =
                            isSameDay(d0, new Date()) ? `Today — ${format(d0, 'EEEE, MMMM d')}` : format(d0, 'EEEE, MMMM d')
                          return (
                            <div key={date}>
                              <h3 className="mb-2 text-[14px] font-semibold text-[var(--text-primary)]">{label}</h3>
                              <ul className="space-y-2">
                                {list.map((s) => {
                                  const st = parseISO(s.scheduled_time)
                                  const name = fullName(s.clients ?? { first_name: null, last_name: null })
                                  const c = clientColorForId(s.client_id)
                                  return (
                                    <li key={s.id}>
                                      <button
                                        type="button"
                                        className="flex w-full items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-3 text-left hover:bg-[var(--bg-subtle)]"
                                        onClick={() => setDetailSession(s)}
                                      >
                                        <span className="w-[72px] shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                                          {format(st, 'h:mm a')}
                                        </span>
                                        <span className="mt-0.5 w-0.5 shrink-0 rounded-full bg-[var(--border-strong)]" style={{ backgroundColor: c }} />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[14px] font-medium text-[var(--text-primary)]">{name}</p>
                                          <p className="text-[12px] text-[var(--text-tertiary)]">
                                            {s.duration_minutes ?? 60} min · {s.session_type?.trim() || 'Video'}
                                          </p>
                                          {s.notes?.trim() ? (
                                            <p className="mt-1 truncate text-[12px] italic text-[var(--text-tertiary)]">{s.notes}</p>
                                          ) : null}
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
                  ) : null}
                </ErrorBoundary>
              )}
            </div>

            <div className={cn('flex min-h-[420px] flex-col lg:hidden', mobileTab === 'today' ? 'flex' : 'hidden')}>
              <ScheduleTodayPanel
                focusDay={panelDay}
                sessions={sessions}
                rules={rules}
                now={nowTick}
                onSessionClick={(s) => setDetailSession(s)}
                onBookSession={() => openBookModal(null, null)}
                onEditAvailability={() => setAvailabilityOpen(true)}
                onViewFullSchedule={() => setMobileTab('week')}
              />
            </div>

            <div className={cn('min-h-0 flex-1 flex-col pb-4 lg:hidden', mobileTab === 'week' ? 'flex' : 'hidden')}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-2"
                  aria-label="Previous days"
                  onClick={() => setMobileAnchor((d) => addDays(d, -1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">3-day view</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-2"
                  aria-label="Next days"
                  onClick={() => setMobileAnchor((d) => addDays(d, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              {calendarLoading ? (
                <div className="h-[400px] animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
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

            <div className={cn('min-h-0 flex-1 lg:hidden', mobileTab === 'agenda' ? 'block' : 'hidden')}>
              <div className="max-h-[70vh] space-y-6 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-4">
                {agendaGroups.length === 0 ? (
                  <p className="text-[14px] text-[var(--text-tertiary)]">No upcoming sessions.</p>
                ) : (
                  agendaGroups.map(({ date, list }) => {
                    const d0 = parseISO(`${date}T12:00:00`)
                    const label =
                      isSameDay(d0, new Date()) ? `Today — ${format(d0, 'EEEE, MMMM d')}` : format(d0, 'EEEE, MMMM d')
                    return (
                      <div key={date}>
                        <h3 className="mb-2 text-[14px] font-semibold">{label}</h3>
                        <ul className="space-y-2">
                          {list.map((s) => {
                            const st = parseISO(s.scheduled_time)
                            const name = fullName(s.clients ?? { first_name: null, last_name: null })
                            return (
                              <li key={s.id}>
                                <button
                                  type="button"
                                  className="flex w-full flex-col rounded-lg border border-[var(--border-default)] p-3 text-left"
                                  onClick={() => setDetailSession(s)}
                                >
                                  <span className="text-[13px] font-semibold">{format(st, 'h:mm a')}</span>
                                  <span className="text-[14px] font-medium">{name}</span>
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
          </div>
        </section>

        {detailSession ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              aria-label="Close session details"
              onClick={() => setDetailSession(null)}
            />
            <div
              className={cn(
                'z-50 flex flex-col border-[var(--border-subtle)] bg-[var(--cp-offwhite)] shadow-[var(--shadow-xl)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                'fixed inset-x-0 bottom-0 max-h-[90vh] rounded-t-[var(--radius-xl)] border-t lg:absolute lg:inset-x-auto lg:top-0 lg:right-0 lg:bottom-0 lg:h-full lg:max-h-none lg:w-[320px] lg:rounded-none lg:border-t-0 lg:border-l'
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
        ) : null}
      </div>

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

      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-xl)] lg:bottom-8 lg:hidden"
        aria-label="Book session"
        onClick={() => openBookModal(null, null)}
      >
        <span className="text-2xl leading-none">+</span>
      </button>

      <div className="fixed right-4 top-20 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-lg px-3 py-2 text-sm ${toastStyle(toast.type)}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}
