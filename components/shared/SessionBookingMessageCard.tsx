'use client'

import { format } from 'date-fns'

export type SessionBookingCardData = {
  type: 'session'
  sessionId: string
  scheduledTime: string
  endTime?: string | null
  durationMinutes: number
  status: string
  notes?: string | null
}

export function SessionBookingMessageCard({ data }: { data: SessionBookingCardData }) {
  const start = new Date(data.scheduledTime)
  return (
    <div className="min-w-[260px] max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--color-muted)">Session scheduled</p>
      <p className="mt-2 font-medium text-[var(--color-ink)]">{format(start, 'EEEE, MMM d, yyyy')}</p>
      <p className="mt-1 text-[15px] text-[var(--color-ink)]">{format(start, 'h:mm a')}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {data.durationMinutes} min · {data.status}
      </p>
      {data.notes ? (
        <p className="mt-2 text-sm text-[var(--color-muted)]">{data.notes}</p>
      ) : null}
    </div>
  )
}
