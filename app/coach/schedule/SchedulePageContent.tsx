'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO, startOfWeek, addDays, addMinutes, addMonths, startOfMonth, isSameDay, isSameMonth } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase'
import { AddAvailabilityModal } from './AddAvailabilityModal'
import { BookSessionModal } from './BookSessionModal'
import { SessionDetailDrawer, type SessionForDrawer } from './SessionDetailDrawer'
import { WeeklyUnavailabilityEditor } from '@/components/unavailability/WeeklyUnavailabilityEditor'
import { cn } from '@/lib/utils'

type CalendarView = 'week' | 'month' | 'agenda'

type RecurringRule = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  label: string | null
  is_active: boolean
}

type Slot = {
  id: string
  start_time: string
  end_time: string
  label: string | null
}

type SessionWithClient = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  notes: string | null
  client_id: string
  session_type: string | null
  clients: { first_name: string | null; last_name: string | null } | null
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function sessionBlockClasses(session: SessionWithClient): string {
  const t = (session.session_type ?? 'video').toLowerCase()
  if (t.includes('phone')) {
    return 'rounded border border-[var(--success)] bg-[var(--success-bg)] px-2 py-1 text-[12px] font-medium text-[var(--success)]'
  }
  if (t.includes('person') || t.includes('in_person') || t.includes('in-person')) {
    return 'rounded border border-[var(--warning)] bg-[var(--warning-bg)] px-2 py-1 text-[12px] font-medium text-[var(--warning)]'
  }
  return 'rounded border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-1 text-[12px] font-medium text-[var(--accent)]'
}

function formatTimeRange(start: string, end: string): string {
  const s = start.slice(0, 5)
  const e = end.slice(0, 5)
  return `${s} – ${e}`
}

export function SchedulePageContent() {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [sessions, setSessions] = useState<SessionWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<CalendarView>('week')
  const [date, setDate] = useState(new Date())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookModalRescheduleSessionId, setBookModalRescheduleSessionId] = useState<string | null>(null)
  const [bookModalInitialClientId, setBookModalInitialClientId] = useState<string | null>(null)
  const [bookModalInitialDuration, setBookModalInitialDuration] = useState<number | null>(null)
  const [selectedSession, setSelectedSession] = useState<SessionForDrawer | null>(null)
  const [materializeLoading, setMaterializeLoading] = useState(false)
  const [materializeMessage, setMaterializeMessage] = useState<string | null>(null)

  const fetchAvailability = useCallback(async () => {
    const res = await fetch('/api/availability')
    const json = await res.json()
    if (res.ok && Array.isArray(json.data)) {
      setRules(json.data.filter((r: RecurringRule) => r.is_active))
    }
  }, [])

  const fetchSlotsAndSessions = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date()
    const sixWeeksLater = new Date(now)
    sixWeeksLater.setDate(sixWeeksLater.getDate() + 42)
    const startIso = now.toISOString()
    const endIso = sixWeeksLater.toISOString()

    const [slotsRes, sessionsRes] = await Promise.all([
      supabase.from('availability_slots').select('id, start_time, end_time, label').eq('coach_id', user.id).gte('start_time', startIso).lte('end_time', endIso).order('start_time'),
      supabase.from('sessions').select('id, scheduled_time, end_time, duration_minutes, status, notes, client_id, session_type, clients(first_name, last_name)').eq('coach_id', user.id).gte('scheduled_time', startIso).lte('scheduled_time', endIso).in('status', ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).order('scheduled_time'),
    ])
    if (slotsRes.data) setSlots(slotsRes.data)
    if (sessionsRes.data) setSessions(sessionsRes.data as unknown as SessionWithClient[])
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchAvailability(), fetchSlotsAndSessions()]).finally(() => setLoading(false))
  }, [fetchAvailability, fetchSlotsAndSessions])

  useEffect(() => {
    load()
  }, [load])

  const handleMaterialize = async () => {
    setMaterializeMessage(null)
    setMaterializeLoading(true)
    try {
      const res = await fetch('/api/availability/materialize', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setMaterializeMessage(`Slots generated${json.data?.created ? ` (${json.data.created} new)` : ''}`)
        fetchSlotsAndSessions()
      } else {
        setMaterializeMessage(json.error ?? 'Could not generate slots')
      }
    } finally {
      setMaterializeLoading(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    await fetch(`/api/availability/${id}`, { method: 'DELETE' })
    fetchAvailability()
  }

  const rulesByDay = DAY_NAMES.map((_, i) => rules.filter((r) => r.day_of_week === i))

  type CalEvent = { start: Date; end: Date; title: string; isSlot: boolean; session?: SessionWithClient }
  const calendarEvents: CalEvent[] = [
    ...slots.map((s) => ({
      start: parseISO(s.start_time),
      end: parseISO(s.end_time),
      title: s.label || 'Available',
      isSlot: true as const,
    })),
    ...sessions.map((s) => {
      const start = parseISO(s.scheduled_time)
      const end = s.end_time ? parseISO(s.end_time) : s.duration_minutes ? addMinutes(start, s.duration_minutes) : addMinutes(start, 60)
      const name = [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'
      return {
        start,
        end,
        title: `${name} · ${format(start, 'h:mm a')}`,
        isSlot: false as const,
        session: s,
      }
    }),
  ]

  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i))
  const hours = Array.from({ length: 15 }, (_, i) => i + 6)
  const monthStart = startOfMonth(date)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i))

  const eventsInRange = (dayStart: Date, dayEnd: Date) =>
    calendarEvents.filter((e) => e.end > dayStart && e.start < dayEnd)

  const sessionsByDate = sessions.reduce<Record<string, SessionWithClient[]>>((acc, s) => {
    const key = format(parseISO(s.scheduled_time), 'yyyy-MM-dd')
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})
  const sortedDates = Object.keys(sessionsByDate).sort()
  const agendaSessions = sortedDates.flatMap((d) =>
    (sessionsByDate[d] ?? []).map((s) => ({ date: d, session: s }))
  )

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
      <div className="min-w-0 flex-1 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-0 border-b border-[var(--border-subtle)]">
          {(['week', 'month', 'agenda'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v === 'agenda' ? 'agenda' : v)}
              className={`relative h-9 px-4 text-[14px] capitalize transition-colors duration-150 ${
                view === v
                  ? 'font-medium text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--accent)]'
                  : 'font-normal text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAddModalOpen(true)}>
            Set availability
          </Button>
          <Button
            onClick={() => {
              setBookModalRescheduleSessionId(null)
              setBookModalInitialClientId(null)
              setBookModalInitialDuration(null)
              setBookModalOpen(true)
            }}
          >
            Book session
          </Button>
        </div>
      </div>

      {/* Availability settings card */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 md:p-6">
        <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-text-primary)]">
          Your availability
        </h2>
        {loading ? (
          <div className="mt-3 h-20 animate-pulse rounded-lg bg-[var(--color-surface)]" />
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {rulesByDay.map((dayRules, dayIndex) =>
                dayRules.length ? (
                  <div key={dayIndex} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">{DAY_NAMES[dayIndex]}:</span>
                    {dayRules.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
                        {formatTimeRange(r.start_time, r.end_time)}
                        {r.label && <span className="text-[var(--color-text-secondary)]">· {r.label}</span>}
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(r.id)}
                          className="ml-1 rounded p-0.5 hover:bg-[var(--color-error-light)] text-[var(--color-error)]"
                          aria-label="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null
              )}
              {rules.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No recurring availability. Add rules below, then generate slots.</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setAddModalOpen(true)}>
                Add availability
              </Button>
              <Button variant="secondary" onClick={handleMaterialize} disabled={materializeLoading}>
                {materializeLoading ? 'Generating…' : 'Generate slots for next 6 weeks'}
              </Button>
            </div>
            {materializeMessage && (
              <p className={`mt-2 text-sm ${materializeMessage.startsWith('Slots') ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                {materializeMessage}
              </p>
            )}
          </>
        )}
      </section>

      <WeeklyUnavailabilityEditor variant="coach" />

      <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] p-4 md:p-6">
        {view !== 'agenda' ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {view === 'week' ? format(weekStart, 'MMM d, yyyy') : format(date, 'MMMM yyyy')}
          </span>
          <Button variant="ghost" onClick={() => setDate(view === 'week' ? addDays(date, -7) : addMonths(date, -1))}>
            Previous
          </Button>
          <Button variant="ghost" onClick={() => setDate(view === 'week' ? addDays(date, 7) : addMonths(date, 1))}>
            Next
          </Button>
        </div>
        ) : null}

        {loading ? (
          <div className="h-[400px] animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              {view === 'agenda' && (
                <ul className="space-y-2">
                  {agendaSessions.length === 0 ? (
                    <p className="text-sm text-[var(--text-tertiary)]">No sessions in the next 6 weeks.</p>
                  ) : (
                    agendaSessions.map(({ date: d, session: s }) => {
                      const start = parseISO(s.scheduled_time)
                      const name = [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSession(s as SessionForDrawer)}
                            className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-left transition-colors duration-[80ms] hover:bg-[var(--bg-subtle)]"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{name}</span>
                            <span className={cn('shrink-0 rounded px-2 py-0.5 text-[11px] font-medium', sessionBlockClasses(s))}>
                              {format(parseISO(d), 'EEE MMM d')} · {format(start, 'h:mm a')}
                            </span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              )}
              {view === 'week' && (
                <div className="min-w-[600px] border border-[var(--color-border)] rounded-lg">
                  <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] text-sm">
                    <div className="border-b border-r border-[var(--color-border)] p-2" />
                    {weekDays.map((d) => (
                      <div key={d.toISOString()} className="border-b border-r border-[var(--color-border)] p-2 text-center font-medium text-[var(--color-text-primary)]">
                        {format(d, 'EEE M/d')}
                      </div>
                    ))}
                  </div>
                  {hours.map((hour) => (
                    <div key={hour} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-[var(--color-border)] min-h-[48px]">
                      <div className="border-r border-[var(--color-border)] p-1 text-[var(--color-text-secondary)] text-xs">
                        {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                      </div>
                      {weekDays.map((day) => {
                        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0)
                        const dayEnd = addMinutes(dayStart, 60)
                        const evts = eventsInRange(dayStart, dayEnd)
                        return (
                          <div key={day.toISOString() + hour} className="border-r border-[var(--color-border)] last:border-r-0 relative min-h-[48px]">
                            {evts.map((ev) => (
                              <button
                                key={ev.start.toISOString() + ev.title}
                                type="button"
                                onClick={() => !ev.isSlot && ev.session && setSelectedSession(ev.session as SessionForDrawer)}
                                className={`absolute left-1 right-1 top-1 bottom-1 truncate rounded px-2 py-1 text-left text-[12px] leading-tight ${
                                  ev.isSlot
                                    ? 'border border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                                    : ev.session?.status === 'completed'
                                      ? 'border border-emerald-600 bg-emerald-500 text-white'
                                      : ev.session?.status === 'cancelled'
                                        ? 'border border-slate-500 bg-slate-400 text-white'
                                        : ev.session?.status === 'no_show'
                                          ? 'border border-amber-600 bg-amber-500 text-white'
                                          : ev.session
                                            ? sessionBlockClasses(ev.session)
                                            : 'border border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
                                }`}
                              >
                                {ev.title}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
              {view === 'month' && (
                <div className="min-w-[600px] border border-[var(--color-border)] rounded-lg">
                  <div className="grid grid-cols-7 text-sm border-b border-[var(--color-border)]">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name) => (
                      <div key={name} className="border-r border-[var(--color-border)] p-2 text-center font-medium text-[var(--color-text-secondary)] last:border-r-0">{name}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthDays.map((d) => {
                      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
                      const dayEnd = addMinutes(dayStart, 24 * 60)
                      const evts = eventsInRange(dayStart, dayEnd).filter((e) => !e.isSlot)
                      const isCurrentMonth = isSameMonth(d, date)
                      const isToday = isSameDay(d, new Date())
                      return (
                        <div
                          key={d.toISOString()}
                          className={`min-h-[80px] border-r border-b border-[var(--color-border)] p-1 ${!isCurrentMonth ? 'bg-[var(--color-surface)]/50' : ''} ${isToday ? 'bg-[var(--color-accent-light)]/30' : ''}`}
                        >
                          <span className={`text-sm ${isCurrentMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>{format(d, 'd')}</span>
                          <div className="mt-1 space-y-0.5">
                            {evts.slice(0, 3).map((ev) => (
                              <button
                                key={ev.start.toISOString()}
                                type="button"
                                onClick={() => ev.session && setSelectedSession(ev.session as SessionForDrawer)}
                                className="block w-full text-left rounded px-1.5 py-0.5 text-xs truncate bg-[var(--color-accent)] text-white"
                              >
                                {ev.title}
                              </button>
                            ))}
                            {evts.length > 3 && <span className="text-xs text-[var(--color-text-secondary)]">+{evts.length - 3}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="lg:hidden">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Upcoming sessions</h3>
              {agendaSessions.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No sessions in the next 6 weeks.</p>
              ) : (
                <ul className="space-y-3">
                  {agendaSessions.slice(0, 20).map(({ date: d, session: s }) => {
                    const start = parseISO(s.scheduled_time)
                    const name = [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3"
                      >
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">{name}</p>
                          <p className="text-sm text-[var(--color-text-secondary)]">{format(parseISO(d), 'EEE, MMM d')} · {format(start, 'h:mm a')}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'confirmed' ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' :
                          s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          s.status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                          s.status === 'no_show' ? 'bg-amber-100 text-amber-700' :
                          'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
                        }`}>{s.status}</span>
                        <Button variant="ghost" onClick={() => setSelectedSession(s as SessionForDrawer)}>Details</Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      {selectedSession ? (
        <div className="lg:hidden">
          <SessionDetailDrawer
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
            onUpdated={load}
            onReschedule={() => {
              setBookModalRescheduleSessionId(selectedSession.id)
              setBookModalInitialClientId(selectedSession.client_id)
              setBookModalInitialDuration(selectedSession.duration_minutes ?? 60)
              setSelectedSession(null)
              setBookModalOpen(true)
            }}
          />
        </div>
      ) : null}
      </div>

      {selectedSession ? (
        <div className="hidden w-[320px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-app)] lg:block">
          <SessionDetailDrawer
            className="sticky top-2 max-h-[calc(100dvh-var(--nav-height)-16px)]"
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
            onUpdated={load}
            onReschedule={() => {
              setBookModalRescheduleSessionId(selectedSession.id)
              setBookModalInitialClientId(selectedSession.client_id)
              setBookModalInitialDuration(selectedSession.duration_minutes ?? 60)
              setSelectedSession(null)
              setBookModalOpen(true)
            }}
          />
        </div>
      ) : null}

      <AddAvailabilityModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSaved={fetchAvailability} />
      <BookSessionModal
        open={bookModalOpen}
        onClose={() => {
          setBookModalOpen(false)
          setBookModalRescheduleSessionId(null)
          setBookModalInitialClientId(null)
          setBookModalInitialDuration(null)
        }}
        onBooked={load}
        initialClientId={bookModalInitialClientId}
        initialDate={null}
        initialTime={null}
        rescheduleFromSessionId={bookModalRescheduleSessionId}
        initialDurationMinutes={bookModalInitialDuration}
      />
    </div>
  )
}
