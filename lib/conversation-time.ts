import { format, isSameYear, isThisWeek, isToday } from 'date-fns'

/** Short labels for conversation list rows: time today, weekday this week, else MMM d. */
export function formatConversationListTime(iso: string, now = new Date()): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    if (isToday(d)) return format(d, 'h:mm a')
    if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, 'EEE')
    if (isSameYear(d, now)) return format(d, 'MMM d')
    return format(d, 'MMM d, yyyy')
  } catch {
    return '—'
  }
}
