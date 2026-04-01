'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ClientSessionsMonthCalendar,
  type ClientCalendarSession,
} from '@/components/client/ClientSessionsMonthCalendar'
import { RequestSessionModal } from '@/components/client/RequestSessionModal'
import { ClientUnavailabilitySummary } from '@/components/unavailability/ClientUnavailabilitySummary'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type ApiSession = ClientCalendarSession & {
  end_time?: string | null
  session_type?: string | null
  date?: string
}

function SessionDetailReadOnly({ session, onClose }: { session: ApiSession | null; onClose: () => void }) {
  if (!session) return null
  const start = parseISO(session.scheduled_time)
  const end = session.end_time
    ? parseISO(session.end_time)
    : session.duration_minutes
      ? new Date(start.getTime() + session.duration_minutes * 60 * 1000)
      : new Date(start.getTime() + 60 * 60 * 1000)
  const statusVariant =
    session.status === 'confirmed'
      ? 'confirmed'
      : session.status === 'completed'
        ? 'completed'
        : session.status === 'cancelled'
          ? 'cancelled'
          : 'pending'

  return (
    <Modal isOpen onClose={onClose} title="Session">
      <div className="space-y-2 text-sm">
        <p className="font-medium text-[var(--color-ink)]">{format(start, 'EEEE, MMM d, yyyy')}</p>
        <p className="text-[var(--color-muted)]">
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </p>
        {session.type ? <p className="text-[var(--color-muted)]">Type: {session.type}</p> : null}
        {session.notes ? <p className="text-[var(--color-muted)]">{session.notes}</p> : null}
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            statusVariant === 'confirmed'
              ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
              : statusVariant === 'completed'
                ? 'bg-[var(--color-border)] text-[var(--color-muted)]'
                : statusVariant === 'cancelled'
                  ? 'bg-[var(--color-error-light)] text-[var(--color-error)]'
                  : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
          }`}
        >
          {session.status}
        </span>
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function ClientSessionsContent() {
  const [sessions, setSessions] = useState<ApiSession[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestInitialDate, setRequestInitialDate] = useState<string | null>(null)
  const [detailSession, setDetailSession] = useState<ApiSession | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/sessions')
      const json = await res.json()
      if (json.data) {
        const up = (json.data.upcoming ?? []) as ApiSession[]
        const past = (json.data.past ?? []) as ApiSession[]
        setSessions([...up, ...past])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const calendarSessions = useMemo(() => sessions as ClientCalendarSession[], [sessions])

  const openRequest = (dateKey: string | null) => {
    setRequestInitialDate(dateKey)
    setRequestOpen(true)
  }

  const closeRequest = () => {
    setRequestOpen(false)
    setRequestInitialDate(null)
  }

  const calendarUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/feed/client` : '/api/calendar/feed/client'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-medium text-[var(--color-ink)]">Sessions</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Your sessions on the calendar below. Request opens a quick picker — day, time slot, video or in person — and your coach confirms in Messages.
          </p>
        </div>
        <Button type="button" variant="primary" className="shrink-0 self-start" onClick={() => openRequest(null)}>
          Request a session
        </Button>
      </div>

      <ClientUnavailabilitySummary />

      <ClientSessionsMonthCalendar
        sessions={calendarSessions}
        loading={loading}
        onSelectDayForRequest={(d) => openRequest(format(d, 'yyyy-MM-dd'))}
        onSelectSession={(s) => setDetailSession(s as ApiSession)}
      />

      <p className="text-center text-[12px] text-[var(--color-muted)]">
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          download="my-sessions.ics"
          className="link-nav font-medium"
        >
          Add booked sessions to Google Calendar (ICS)
        </a>
      </p>

      <RequestSessionModal
        open={requestOpen}
        onClose={closeRequest}
        initialPreferredDate={requestInitialDate}
        onSent={() => void loadSessions()}
      />

      <SessionDetailReadOnly session={detailSession} onClose={() => setDetailSession(null)} />
    </div>
  )
}
