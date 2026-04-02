'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { addDays, addMonths, addWeeks, endOfDay, format, isSameDay, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BookSessionModal } from './BookSessionModal'
import type { SessionForDrawer } from './SessionDetailDrawer'
import { labelForTimeValue, SESSION_DURATIONS, TIME_SLOTS } from './sessionFormOptions'

type CalendarView = 'week' | 'month'
type Toast = { id: number; text: string; type: 'success' | 'error' | 'warning' }

type ClientRow = {
  id: string
  first_name: string | null
  last_name: string | null
  status: 'active' | 'paused' | 'completed' | string
}

type SessionRow = SessionForDrawer

type AvailabilityRule = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const START_HOUR = 6
const END_HOUR = 22

function fullName(client: Pick<ClientRow, 'first_name' | 'last_name'>): string {
  return [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'
}

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  return (parts[0]?.[0] ?? 'C') + (parts[1]?.[0] ?? '')
}

function toastStyle(type: Toast['type']): string {
  if (type === 'success') return 'bg-[var(--color-success-light)] text-[var(--color-success)]'
  if (type === 'warning') return 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
  return 'bg-[var(--color-error-light)] text-[var(--color-error)]'
}

function isWithinAvailability(date: Date, rule: AvailabilityRule): boolean {
  const day = date.getDay()
  const normalized = day === 0 ? 6 : day - 1
  if (normalized !== rule.day_of_week) return false
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const value = `${hh}:${mm}`
  return value >= rule.start_time.slice(0, 5) && value < rule.end_time.slice(0, 5)
}

function ClientRowButton({
  client,
  active,
  onSelect,
}: {
  client: ClientRow
  active: boolean
  onSelect: (clientId: string) => void
}) {
  const name = fullName(client)
  return (
    <button
      type="button"
      onClick={() => onSelect(client.id)}
      className={`w-full rounded-lg border bg-[var(--color-bg)] p-3 text-left transition-colors ${
        active ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' : 'border-[var(--color-border)] hover:bg-[var(--color-surface)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm text-white">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{name}</p>
          <Badge variant={client.status === 'active' ? 'active' : client.status === 'completed' ? 'inactive' : 'pending'}>
            {client.status}
          </Badge>
        </div>
      </div>
    </button>
  )
}

function SessionCalendarCard({ session, onOpen }: { session: SessionRow; onOpen: (session: SessionRow) => void }) {
  const name = fullName(session.clients ?? { first_name: null, last_name: null })
  const statusClass =
    session.status === 'completed'
      ? 'bg-emerald-500'
      : session.status === 'cancelled'
        ? 'bg-slate-500'
        : session.status === 'no_show'
          ? 'bg-amber-500'
          : 'bg-[var(--color-accent)]'
  return (
    <button
      type="button"
      className={`w-full rounded px-2 py-1.5 text-left text-xs text-white hover:brightness-95 ${statusClass}`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(session)
      }}
    >
      <span className="block truncate font-medium">{name}</span>
                    <span className="block truncate text-[10px] text-white/90">{session.status} · tap to edit</span>
    </button>
  )
}

function SlotCell({
  available,
  hasSession,
  onEmptyClick,
  children,
}: {
  available: boolean
  hasSession: boolean
  onEmptyClick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!hasSession) onEmptyClick()
      }}
      onKeyDown={(e) => {
        if (!hasSession && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onEmptyClick()
        }
      }}
      className={`relative h-12 border-r border-b border-[var(--color-border)] p-1 ${
        available ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-bg)]'
      } ${!hasSession ? 'cursor-pointer hover:bg-[var(--color-surface)]/80' : ''}`}
    >
      {children}
    </div>
  )
}

function SessionQuickModal({
  session,
  onClose,
  onRemoved,
  onSaved,
  onToast,
  onReschedule,
}: {
  session: SessionRow
  onClose: () => void
  onRemoved: () => void
  onSaved: (updated: SessionRow) => void
  onToast: (text: string, type?: Toast['type']) => void
  onReschedule?: () => void
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('10:00')
  const [editDuration, setEditDuration] = useState(60)
  const [editNotes, setEditNotes] = useState('')

  const clientName = [session.clients?.first_name, session.clients?.last_name].filter(Boolean).join(' ') || 'Client'
  const isCompleted = session.status === 'completed'
  const canDelete = session.status !== 'completed'

  useEffect(() => {
    const d = new Date(session.scheduled_time)
    setEditDate(format(d, 'yyyy-MM-dd'))
    setEditTime(format(d, 'HH:mm'))
    setEditDuration(session.duration_minutes ?? 60)
    setEditNotes(session.notes ?? '')
    setSaveError(null)
    setConfirmRemove(false)
  }, [session.id, session.scheduled_time, session.duration_minutes, session.notes])

  const timeSelectOptions = useMemo(() => {
    const slots = [...TIME_SLOTS]
    if (editTime && !slots.some((s) => s.value === editTime)) {
      slots.unshift({ value: editTime, label: labelForTimeValue(editTime) })
    }
    return slots
  }, [editTime])

  const save = async () => {
    setSaveLoading(true)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = { notes: editNotes.trim() || null }
      if (!isCompleted) {
        body.date = editDate
        body.startTime = editTime
        body.durationMinutes = editDuration
      }
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveError(typeof json.error === 'string' ? json.error : 'Could not save changes')
        return
      }
      onToast('Session updated', 'success')
      onSaved(json.data as SessionRow)
    } finally {
      setSaveLoading(false)
    }
  }

  const remove = async () => {
    setRemoveLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
      if (res.ok) {
        onToast('Session removed from calendar', 'success')
        onRemoved()
        onClose()
      } else {
        const json = await res.json().catch(() => ({}))
        onToast(typeof json.error === 'string' ? json.error : "Couldn't remove session", 'error')
      }
    } finally {
      setRemoveLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-quick-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-lg max-md:max-w-none md:rounded-xl max-md:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="session-quick-title" className="text-lg font-medium text-[var(--color-text-primary)]">
          Edit session
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-primary)]">
          <span className="text-[var(--color-text-secondary)]">Client</span>
          <br />
          <span className="font-medium">{clientName}</span>
        </p>

        <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
          <div>
            <label htmlFor="session-edit-notes" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Title / notes
            </label>
            <textarea
              id="session-edit-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Session focus, internal title…"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
            />
          </div>
          <div>
            <label htmlFor="session-edit-date" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Date
            </label>
            <input
              id="session-edit-date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              disabled={isCompleted}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="session-edit-time" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Start time
            </label>
            <select
              id="session-edit-time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              disabled={isCompleted}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {timeSelectOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="session-edit-duration" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Duration
            </label>
            <select
              id="session-edit-duration"
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
              disabled={isCompleted}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] disabled:opacity-60"
            >
              {SESSION_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          {isCompleted ? (
            <p className="text-xs text-[var(--color-text-secondary)]">Date, time, and duration are locked for completed sessions. You can still update notes.</p>
          ) : null}
          {saveError ? (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {saveError}
            </p>
          ) : null}
          <Button type="button" onClick={save} disabled={saveLoading || removeLoading}>
            {saveLoading ? 'Saving…' : 'Save changes'}
          </Button>
          {!isCompleted && onReschedule ? (
            <Button
              type="button"
              variant="secondary"
              disabled={saveLoading || removeLoading}
              onClick={() => onReschedule()}
            >
              Reschedule to new time
            </Button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
          {!canDelete ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Completed sessions cannot be removed from the calendar.</p>
          ) : !confirmRemove ? (
            <Button variant="destructive-secondary" type="button" onClick={() => setConfirmRemove(true)} disabled={removeLoading || saveLoading}>
              Remove from calendar
            </Button>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <p className="mb-3 text-sm text-[var(--color-text-primary)]">Remove this session? This cannot be undone.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" type="button" onClick={remove} disabled={removeLoading}>
                  {removeLoading ? 'Removing…' : 'Remove'}
                </Button>
                <Button variant="secondary" type="button" onClick={() => setConfirmRemove(false)} disabled={removeLoading}>
                  Back
                </Button>
              </div>
            </div>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CoachScheduleWorkspace() {
  const searchParams = useSearchParams()

  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientSearch, setClientSearch] = useState('')
  const [activeClientId, setActiveClientId] = useState<string | null>(null)

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [manageSession, setManageSession] = useState<SessionRow | null>(null)

  const [view, setView] = useState<CalendarView>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [monthDate, setMonthDate] = useState(new Date())

  const [modalOpen, setModalOpen] = useState(false)
  const [modalClientId, setModalClientId] = useState<string | null>(null)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalTime, setModalTime] = useState<string | null>(null)
  const [rescheduleFromSessionId, setRescheduleFromSessionId] = useState<string | null>(null)
  const [modalInitialDurationMinutes, setModalInitialDurationMinutes] = useState<number | null>(null)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [calendarSubscribeUrl, setCalendarSubscribeUrl] = useState<string | null>(null)
  const [calendarUrlLoading, setCalendarUrlLoading] = useState(true)

  const sessionFetchRange = useMemo(() => {
    if (view === 'week') {
      return {
        from: startOfDay(weekStart).toISOString(),
        to: endOfDay(addDays(weekStart, 6)).toISOString(),
      }
    }
    const gridStart = startOfWeek(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), { weekStartsOn: 1 })
    return {
      from: startOfDay(gridStart).toISOString(),
      to: endOfDay(addDays(gridStart, 41)).toISOString(),
    }
  }, [view, weekStart, monthDate])

  const addToast = (text: string, type: Toast['type'] = 'success') => {
    const item: Toast = { id: Date.now() + Math.random(), text, type }
    setToasts((prev) => [...prev, item])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), 4000)
  }

  const load = useCallback(async () => {
    setClientsLoading(true)
    setCalendarLoading(true)
    try {
      const params = new URLSearchParams({
        from: sessionFetchRange.from,
        to: sessionFetchRange.to,
      })
      const [clientsRes, sessionsRes, availabilityRes] = await Promise.all([
        fetch('/api/clients?status=active'),
        fetch(`/api/coach/sessions?${params}`),
        fetch('/api/availability'),
      ])
      const clientsJson = await clientsRes.json()
      const sessionsJson = await sessionsRes.json()
      const availabilityJson = await availabilityRes.json()

      if (clientsRes.ok) setClients(clientsJson.data ?? [])
      if (clientsRes.ok && !activeClientId) setActiveClientId(clientsJson.data?.[0]?.id ?? null)
      if (sessionsRes.ok) setSessions(sessionsJson.data ?? [])
      if (availabilityRes.ok) setRules((availabilityJson.data ?? []).filter((r: AvailabilityRule) => r.is_active))
    } finally {
      setClientsLoading(false)
      setCalendarLoading(false)
    }
  }, [sessionFetchRange.from, sessionFetchRange.to, activeClientId])

  useEffect(() => {
    load()
  }, [load])

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
    if (found) setManageSession(found)
  }, [searchParams, sessions])

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter((c) => fullName(c).toLowerCase().includes(q))
  }, [clients, clientSearch])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const timeRows = useMemo(() => {
    const rows: { hour: number; minute: number; label: string }[] = []
    for (let hour = START_HOUR; hour < END_HOUR; hour += 1) {
      for (const minute of [0, 30]) {
        rows.push({
          hour,
          minute,
          label:
            minute === 0
              ? hour < 12
                ? `${hour}a`
                : hour === 12
                  ? '12p'
                  : `${hour - 12}p`
              : '',
        })
      }
    }
    return rows
  }, [])

  const sessionBySlot = useMemo(() => {
    const map = new Map<string, SessionRow>()
    sessions.forEach((s) => {
      const dt = parseISO(s.scheduled_time)
      const key = `slot-${format(dt, 'yyyy-MM-dd')}-${format(dt, 'HH:mm')}`
      map.set(key, s)
    })
    return map
  }, [sessions])

  const currentTimeLine = (() => {
    const now = new Date()
    const today = weekDays.find((d) => isSameDay(d, now))
    if (!today) return null
    const mins = now.getHours() * 60 + now.getMinutes()
    const startMins = START_HOUR * 60
    const endMins = END_HOUR * 60
    if (mins < startMins || mins > endMins) return null
    return { dayIndex: weekDays.findIndex((d) => isSameDay(d, now)), top: ((mins - startMins) / 30) * 48 }
  })()

  const openBookModalFor = (date: string, time: string) => {
    if (!activeClientId) {
      addToast('Select a client in the list first', 'warning')
      return
    }
    setRescheduleFromSessionId(null)
    setModalInitialDurationMinutes(null)
    setModalDate(date)
    setModalTime(time)
    setModalClientId(activeClientId)
    setModalOpen(true)
  }

  const openBookModalFreeform = () => {
    setRescheduleFromSessionId(null)
    setModalInitialDurationMinutes(null)
    setModalClientId(activeClientId ?? filteredClients[0]?.id ?? null)
    setModalDate(null)
    setModalTime(null)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[var(--text-24)]">
          Schedule
        </h1>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm">
        <p className="font-medium text-[var(--color-text-primary)]">Calendar sync</p>
        {calendarUrlLoading ? (
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading your subscribe link…</p>
        ) : calendarSubscribeUrl ? (
          <>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              Paste this URL in Google Calendar (&quot;From URL&quot;) or Apple Calendar. It includes a private token — treat it like a password.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                readOnly
                value={calendarSubscribeUrl}
                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[12px] text-[var(--color-text-primary)]"
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
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Upcoming sessions (next 90 days). Or{' '}
              <a href="/api/calendar/feed/coach" className="font-medium text-[var(--color-accent)] hover:underline">
                download .ics once
              </a>{' '}
              while signed in.
            </p>
          </>
        ) : (
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Could not load a calendar link. Try refreshing, or{' '}
            <a href="/api/calendar/feed/coach" className="font-medium text-[var(--color-accent)] hover:underline">
              download .ics
            </a>{' '}
            while signed in.
          </p>
        )}
      </div>

      {!calendarLoading && sessions.length === 0 && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-8 text-center">
          <p className="text-3xl" aria-hidden>
            📅
          </p>
          <p className="mt-3 text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Your calendar is clear
          </p>
          <p className="mx-auto mt-2 max-w-[440px] text-[var(--text-14)] font-normal leading-[1.6] text-[var(--text-tertiary)]">
            Book your first session or set up your availability so clients can see your schedule.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" className="min-h-11" onClick={openBookModalFreeform}>
              Book a session
            </Button>
            <Link
              href="#coach-schedule-grid"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-default)] bg-[var(--bg-app)] px-4 text-[14px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-all hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]"
            >
              Set availability
            </Link>
          </div>
        </div>
      )}

      <div className="hidden lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <aside className="h-[78vh] overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <h2 className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">Clients</h2>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Select a client, then click an empty slot on the calendar to choose date and time and book.
          </p>
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Search clients"
            className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          />
          {clientsLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-surface)]" />)}</div>
          ) : filteredClients.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No active clients yet</p>
          ) : (
            <div className="space-y-2">
              {filteredClients.map((client) => (
                <ClientRowButton key={client.id} client={client} active={client.id === activeClientId} onSelect={setActiveClientId} />
              ))}
            </div>
          )}
        </aside>

        <section id="coach-schedule-grid" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => (view === 'week' ? setWeekStart((d) => addWeeks(d, -1)) : setMonthDate((d) => addMonths(d, -1)))}
              >
                {view === 'week' ? 'Prev week' : 'Prev month'}
              </Button>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {view === 'week' ? `${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d, yyyy')}` : format(monthDate, 'MMMM yyyy')}
              </p>
              <Button
                variant="ghost"
                onClick={() => (view === 'week' ? setWeekStart((d) => addWeeks(d, 1)) : setMonthDate((d) => addMonths(d, 1)))}
              >
                {view === 'week' ? 'Next week' : 'Next month'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                  setMonthDate(new Date())
                }}
              >
                Today
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={view === 'week' ? 'primary' : 'secondary'} onClick={() => setView('week')}>
                Week
              </Button>
              <Button variant={view === 'month' ? 'primary' : 'secondary'} onClick={() => setView('month')}>
                Month
              </Button>
              <Button onClick={openBookModalFreeform}>Book session</Button>
            </div>
          </div>
          <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
            Click a session to edit time, duration, or notes—or use Reschedule to move it to a new slot (the old time is removed after you book). There is no drag-and-drop on the grid. Empty slots open the booking form when a client is selected.
          </p>

          {calendarLoading ? (
            <div className="h-[70vh] animate-pulse rounded-lg bg-[var(--color-surface)]" />
          ) : (
            <ErrorBoundary
              fallback={
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-8 text-center text-[15px] text-[var(--color-muted)]">
                  <p className="font-medium text-[var(--color-text-primary)]">Calendar could not be displayed</p>
                  <p className="mt-1 text-[13px]">Try again or refresh the page.</p>
                </div>
              }
            >
          {view === 'week' ? (
            <div className="relative overflow-auto border border-[var(--color-border)]">
              <div className="grid grid-cols-[70px_repeat(7,minmax(140px,1fr))]">
                <div className="border-r border-b border-[var(--color-border)] bg-[var(--color-bg)]" />
                {weekDays.map((day, idx) => (
                  <div key={day.toISOString()} className="border-r border-b border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-center text-sm font-medium">
                    {DAYS[idx]} {format(day, 'M/d')}
                  </div>
                ))}
                {timeRows.map((row) => (
                  <div key={`${row.hour}:${row.minute}`} className="contents">
                    <div className="border-r border-b border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                      {row.label}
                    </div>
                    {weekDays.map((day) => {
                      const slotDate = format(day, 'yyyy-MM-dd')
                      const slotTime = `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`
                      const slotId = `slot-${slotDate}-${slotTime}`
                      const slotDateObj = new Date(day.getFullYear(), day.getMonth(), day.getDate(), row.hour, row.minute, 0)
                      const available = rules.some((rule) => isWithinAvailability(slotDateObj, rule))
                      const session = sessionBySlot.get(slotId)
                      return (
                        <SlotCell
                          key={slotId}
                          available={available}
                          hasSession={Boolean(session)}
                          onEmptyClick={() => openBookModalFor(slotDate, slotTime)}
                        >
                          {session ? <SessionCalendarCard session={session} onOpen={setManageSession} /> : null}
                        </SlotCell>
                      )
                    })}
                  </div>
                ))}
              </div>
              {currentTimeLine && (
                <div className="pointer-events-none absolute left-[70px] right-0">
                  <div
                    className="absolute h-[2px] bg-red-500"
                    style={{ top: currentTimeLine.top, left: `${(currentTimeLine.dayIndex / 7) * 100}%`, width: `${100 / 7}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]">
              {Array.from({ length: 42 }, (_, i) =>
                addDays(startOfWeek(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), { weekStartsOn: 1 }), i)
              ).map((day) => {
                const daySessions = sessions.filter((s) => isSameDay(parseISO(s.scheduled_time), day))
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className="min-h-24 bg-[var(--color-bg)] p-2 text-left hover:bg-[var(--color-surface)]"
                    onClick={() => {
                      setWeekStart(startOfWeek(day, { weekStartsOn: 1 }))
                      setView('week')
                    }}
                  >
                    <p className="text-sm text-[var(--color-text-primary)]">{format(day, 'd')}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {daySessions.slice(0, 3).map((s) => (
                        <span key={s.id} className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
            </ErrorBoundary>
          )}
        </section>
      </div>

      <div className="lg:hidden space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <h2 className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">Clients</h2>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">Select who you are booking for, then use Book session.</p>
          {clientsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-surface)]" />)}</div>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setActiveClientId(client.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    client.id === activeClientId ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : 'border-[var(--color-border)] bg-[var(--color-bg)]'
                  }`}
                >
                  {fullName(client)}
                </button>
              ))}
            </div>
          )}
        </div>
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Agenda</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No sessions in this range yet.</p>
        ) : (
          Object.entries(
            sessions.reduce<Record<string, SessionRow[]>>((acc, session) => {
              const key = format(parseISO(session.scheduled_time), 'yyyy-MM-dd')
              if (!acc[key]) acc[key] = []
              acc[key].push(session)
              return acc
            }, {})
          ).map(([date, daySessions]) => (
            <div key={date} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">{format(parseISO(`${date}T00:00:00`), 'EEEE, MMM d')}</h3>
              <div className="space-y-2">
                {daySessions.map((session) => {
                  const name = fullName(session.clients ?? { first_name: null, last_name: null })
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-left hover:bg-[var(--color-surface)]"
                      onClick={() => setManageSession(session)}
                    >
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{name}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {format(parseISO(session.scheduled_time), 'h:mm a')} · {session.duration_minutes ?? 60} min
                        </p>
                      </div>
                      <Badge variant={session.status === 'confirmed' ? 'active' : session.status === 'completed' ? 'active' : 'pending'}>
                        {session.status}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <Button
          className="fixed bottom-20 right-4 z-30 min-h-[48px] shadow-lg lg:bottom-8 lg:right-5"
          onClick={openBookModalFreeform}
        >
          Book session
        </Button>
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

      {manageSession ? (
        <SessionQuickModal
          session={manageSession}
          onClose={() => setManageSession(null)}
          onRemoved={load}
          onSaved={(updated) => {
            setManageSession(updated)
            load()
          }}
          onToast={addToast}
          onReschedule={() => {
            setRescheduleFromSessionId(manageSession.id)
            setModalClientId(manageSession.client_id)
            setModalInitialDurationMinutes(manageSession.duration_minutes ?? 60)
            setModalDate(null)
            setModalTime(null)
            setManageSession(null)
            setModalOpen(true)
          }}
        />
      ) : null}

      <div className="fixed right-4 top-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-lg px-3 py-2 text-sm ${toastStyle(toast.type)}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}
