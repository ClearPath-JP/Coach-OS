import { format, isSameDay, parseISO } from 'date-fns'

export type SessionRow = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  session_type?: string | null
  clients: { first_name: string | null; last_name: string | null } | null
}

export type ConversationRow = {
  clientId: string
  fullName: string
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
  hasMessages: boolean
}

export type TodayItem = { id: string; time: string; title: string; sub: string }
export type MessageItem = { clientId: string; name: string; preview: string; unread: number }

function clientName(c: SessionRow['clients']): string {
  if (!c) return 'Client'
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || 'Client'
}

/** Today's sessions, sorted ascending, mapped to display rows. */
export function todayRows(sessions: SessionRow[], now: Date): TodayItem[] {
  return sessions
    .filter((s) => {
      try {
        return isSameDay(parseISO(s.scheduled_time), now)
      } catch {
        return false
      }
    })
    .sort((a, b) => parseISO(a.scheduled_time).getTime() - parseISO(b.scheduled_time).getTime())
    .map((s) => ({
      id: s.id,
      time: format(parseISO(s.scheduled_time), 'h:mm a'),
      title: clientName(s.clients),
      sub: s.session_type?.trim() || 'Session',
    }))
}

/** The first session later today, for the "Next: … at …" line. */
export function nextSession(sessions: SessionRow[], now: Date): { name: string; time: string } | null {
  const upcoming = sessions
    .filter((s) => {
      try {
        const t = parseISO(s.scheduled_time)
        return isSameDay(t, now) && t.getTime() > now.getTime()
      } catch {
        return false
      }
    })
    .sort((a, b) => parseISO(a.scheduled_time).getTime() - parseISO(b.scheduled_time).getTime())[0]
  if (!upcoming) return null
  return { name: clientName(upcoming.clients), time: format(parseISO(upcoming.scheduled_time), 'h:mm a') }
}

/** Up to `limit` conversations that have messages, mapped to display rows. */
export function messageRows(convos: ConversationRow[], limit = 3): MessageItem[] {
  return convos
    .filter((c) => c.hasMessages)
    .slice(0, limit)
    .map((c) => ({
      clientId: c.clientId,
      name: c.fullName,
      preview: c.lastMessagePreview,
      unread: c.unreadCount > 0 ? c.unreadCount : 0,
    }))
}

/** Total unread across all conversations. */
export function unreadTotal(convos: ConversationRow[]): number {
  return convos.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0)
}
