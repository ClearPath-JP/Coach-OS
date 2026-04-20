'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns'
import {
  CalendarDays,
  CreditCard,
  MessageSquare,
  Settings,
  Swords,
  Users,
  Video,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-context'
import { formatCents } from '@/lib/format-currency'
import { playHover, playSelect } from '@/lib/game-sounds'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

type SessionRow = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  session_type?: string | null
  clients: { first_name: string | null; last_name: string | null } | null
}

type Summary = {
  activeClientsCount: number
  sessionsThisWeek: number
  revenueMonthCents: number
  revenuePrevMonthCents?: number
  pendingInvoicesCount: number
  clientsAddedThisMonth?: number
  coachMessagesSentCount?: number
}

type ConversationRow = {
  clientId: string
  fullName: string
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
  hasMessages: boolean
}

/* ─── Component ─── */

export function CoachDashboardContent({ coachDisplayName }: { coachDisplayName: string }) {
  const router = useRouter()
  const { settings } = useWorkspace()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const wkStart = startOfWeek(now, { weekStartsOn: 1 })
    const wkEnd = endOfWeek(now, { weekStartsOn: 1 })
    const weekQ = `?from=${encodeURIComponent(wkStart.toISOString())}&to=${encodeURIComponent(wkEnd.toISOString())}`
    try {
      const [sumRes, sessRes, convRes] = await Promise.all([
        fetch('/api/coach/dashboard-summary'),
        fetch(`/api/coach/sessions${weekQ}`),
        fetch('/api/messages/conversations'),
      ])
      const sumJson = await sumRes.json().catch(() => ({}))
      const sessJson = await sessRes.json().catch(() => ({}))
      const convJson = await convRes.json().catch(() => ({}))
      if (sumJson.data) setSummary(sumJson.data)
      if (Array.isArray(sessJson.data)) setSessions(sessJson.data)
      if (Array.isArray(convJson.data)) setConversations(convJson.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const todaySessions = useMemo(() => {
    const today = new Date()
    return sessions
      .filter((s) => {
        try { return isSameDay(parseISO(s.scheduled_time), today) }
        catch { return false }
      })
      .sort((a, b) => parseISO(a.scheduled_time).getTime() - parseISO(b.scheduled_time).getTime())
  }, [sessions])

  const unreadTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0),
    [conversations]
  )

  const nextSession = useMemo(() => {
    const now = new Date()
    const upcoming = todaySessions.find((s) => {
      try { return parseISO(s.scheduled_time).getTime() > now.getTime() }
      catch { return false }
    })
    if (!upcoming) return null
    const start = parseISO(upcoming.scheduled_time)
    const name = [upcoming.clients?.first_name, upcoming.clients?.last_name].filter(Boolean).join(' ') || 'Client'
    return { time: format(start, 'h:mm a'), name }
  }, [todaySessions])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const coachFirst = coachDisplayName.trim().split(/\s+/)[0] || 'Coach'
  const dateLine = format(new Date(), 'EEEE, MMMM d')
  const brandName = settings.brandName || settings.workspaceDisplayName || 'Sensei App'

  const totalClients = summary?.activeClientsCount ?? 0
  const sessionsToday = todaySessions.length
  const pendingInvoices = summary?.pendingInvoicesCount ?? 0
  const revenue = formatCents(summary?.revenueMonthCents ?? 0)

  const menuItems = [
    {
      label: 'Schedule',
      href: '/coach/schedule',
      icon: CalendarDays,
      stat: sessionsToday > 0 ? `${sessionsToday}` : null,
      sub: sessionsToday > 0 ? `session${sessionsToday === 1 ? '' : 's'} today` : 'No sessions today',
    },
    {
      label: 'Clients',
      href: '/coach/clients',
      icon: Users,
      stat: totalClients > 0 ? `${totalClients}` : null,
      sub: totalClients > 0 ? 'active' : 'Add your first',
    },
    {
      label: 'Messages',
      href: '/coach/messages',
      icon: MessageSquare,
      stat: unreadTotal > 0 ? `${unreadTotal}` : null,
      sub: unreadTotal > 0 ? 'unread' : 'All caught up',
    },
    {
      label: 'Programs',
      href: '/coach/programs',
      icon: Swords,
      stat: null,
      sub: 'Training content',
    },
    {
      label: 'Videos',
      href: '/coach/videos',
      icon: Video,
      stat: null,
      sub: 'Session recordings',
    },
    {
      label: 'Payments',
      href: '/coach/payments',
      icon: CreditCard,
      stat: pendingInvoices > 0 ? `${pendingInvoices}` : null,
      sub: pendingInvoices > 0 ? `pending \u00b7 ${revenue}/mo` : `${revenue} this month`,
    },
  ]

  return (
    <div className="sensei-menu">
      {/* Atmospheric background */}
      <div className="sensei-menu__bg" aria-hidden>
        <div className="sensei-menu__bg-gradient" />
        <div className="sensei-menu__bg-mist" />
        <div className="sensei-menu__bg-vignette" />
      </div>

      {/* Content */}
      <div className="sensei-menu__content">

        {/* Left column — brand + menu */}
        <div className="sensei-menu__left">

          {/* Brand */}
          <div className="sensei-menu__brand">
            <h1 className="sensei-menu__brand-name">{brandName}</h1>
            <div className="sensei-menu__brand-rule" />
            <p className="sensei-menu__greeting">
              {loading ? '\u2026' : `${greeting}, ${coachFirst}`}
            </p>
            <p className="sensei-menu__date">{dateLine}</p>
            {nextSession && (
              <p className="sensei-menu__next">
                Next: <strong>{nextSession.name}</strong> at {nextSession.time}
              </p>
            )}
          </div>

          {/* Menu items — GoT Legends style */}
          <nav className="sensei-menu__nav" aria-label="Main menu">
            {menuItems.map((item, i) => (
              <button
                key={item.href}
                type="button"
                className={cn(
                  'sensei-menu__btn',
                  activeIdx === i && 'sensei-menu__btn--active'
                )}
                onClick={() => { playSelect(); router.push(item.href) }}
                onMouseEnter={() => { setActiveIdx(i); playHover() }}
                onMouseLeave={() => setActiveIdx(null)}
                onFocus={() => setActiveIdx(i)}
                onBlur={() => setActiveIdx(null)}
              >
                {/* Red wash overlay on hover */}
                <div className="sensei-menu__btn-wash" aria-hidden />

                {/* Left accent bar */}
                <div className="sensei-menu__btn-accent" aria-hidden />

                {/* Icon */}
                <item.icon className="sensei-menu__btn-icon" strokeWidth={1.5} />

                {/* Label */}
                <span className="sensei-menu__btn-label">{item.label}</span>

                {/* Stat badge */}
                {item.stat && (
                  <span className="sensei-menu__btn-stat">{item.stat}</span>
                )}

                {/* Sub text */}
                <span className="sensei-menu__btn-sub">{item.sub}</span>
              </button>
            ))}
          </nav>

          {/* Bottom — settings + footer */}
          <div className="sensei-menu__bottom">
            <button
              type="button"
              className="sensei-menu__settings"
              onClick={() => { playSelect(); router.push('/coach/settings') }}
              onMouseEnter={playHover}
            >
              <Settings className="size-4" strokeWidth={1.5} />
              <span>Settings</span>
            </button>
            <p className="sensei-menu__footer">Powered by FoundOS</p>
          </div>
        </div>

        {/* Right column — atmospheric space (background shows through) */}
        <div className="sensei-menu__right" aria-hidden />
      </div>
    </div>
  )
}
