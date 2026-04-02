import { format } from 'date-fns'

export type IcsSessionRow = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  notes: string | null
  clients: { first_name?: string | null; last_name?: string | null } | null
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Build iCal body for pre-filtered session rows (caller controls date range). */
export function buildCoachSessionsIcs(sessions: IcsSessionRow[]): string {
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClearPath//Coach Sessions//EN',
    'CALSCALE:GREGORIAN',
  ]

  for (const s of sessions) {
    const start = new Date(s.scheduled_time)
    const end = s.end_time
      ? new Date(s.end_time)
      : new Date(start.getTime() + (s.duration_minutes ?? 60) * 60 * 1000)
    const dtStart = format(start, "yyyyMMdd'T'HHmmss'Z'")
    const dtEnd = format(end, "yyyyMMdd'T'HHmmss'Z'")
    const c = s.clients
    const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Client'
    const summary = escapeIcsText(`Session with ${name}`)
    const descRaw = (s.notes ?? '').trim()
    icsLines.push(
      'BEGIN:VEVENT',
      `UID:coach-session-${s.id}@clearpath`,
      `DTSTAMP:${format(start, "yyyyMMdd'T'HHmmss'Z'")}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`
    )
    if (descRaw) {
      icsLines.push(`DESCRIPTION:${escapeIcsText(descRaw)}`)
    }
    icsLines.push('END:VEVENT')
  }

  icsLines.push('END:VCALENDAR')
  return icsLines.join('\r\n')
}
