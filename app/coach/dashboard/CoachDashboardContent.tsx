'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  eachDayOfInterval,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { BookOpen, CalendarDays, CreditCard, MessageSquare, Plus, TrendingUp, Users } from 'lucide-react'
import { QuickInvoiceModal } from '@/components/coach/QuickInvoiceModal'
import { RecordPaymentModal } from '@/components/coach/RecordPaymentModal'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { sessionTypeLabel } from '@/app/coach/schedule/schedule-lib'
import { formatTrendLabel } from '@/lib/dashboard-trends'
import { formatCents } from '@/lib/format-currency'
import { cn } from '@/lib/utils'

type SessionRow = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  session_type?: string | null
  clients: { first_name: string | null; last_name: string | null } | null
}

type Trend = { pct: number; up: boolean } | null

type Summary = {
  activeClientsCount: number
  sessionsThisWeek: number
  revenueMonthCents: number
  revenuePrevMonthCents?: number
  pendingInvoicesCount: number
  clientsAddedThisMonth?: number
  coachMessagesSentCount?: number
  trends?: {
    activeClients: Trend
    sessionsThisWeek: Trend
    revenueMonth: Trend
    messagesToCoach: Trend
  }
}

type CheckinAlertsPayload = {
  lowMood: {
    clientId: string
    firstName: string | null
    lastName: string | null
    consecutiveLowDays: number
  }[]
  missedCheckin: {
    clientId: string
    firstName: string | null
    lastName: string | null
    daysSinceCheckin: number
  }[]
}

type AttentionPayload = {
  inactive: {
    clientId: string
    firstName: string | null
    lastName: string | null
    lastMessageAt: string | null
  }[]
  overdue: {
    id: string
    dueAt: string
    clientId: string
    templateTitle: string | null
    firstName: string | null
    lastName: string | null
  }[]
  unpaidInvoices: {
    id: string
    amountCents: number
    createdAt: string
    clientId: string
    firstName: string | null
    lastName: string | null
  }[]
  sessions24h: {
    id: string
    scheduledTime: string
    clientId: string
    firstName: string | null
    lastName: string | null
  }[]
  nearComplete: {
    clientId: string
    programTitle: string | null
    completionRatio: number
    firstName: string | null
    lastName: string | null
  }[]
}

const EMPTY_ATTENTION: AttentionPayload = {
  inactive: [],
  overdue: [],
  unpaidInvoices: [],
  sessions24h: [],
  nearComplete: [],
}

type ConversationRow = {
  clientId: string
  fullName: string
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
  hasMessages: boolean
}

type ActivityRow = {
  id: string
  at: string
  kind: string
  summary: string
  clientFirst: string
}

type StorageStrip = {
  usedGb: number
  maxGb: number
  pct: number
}

type ClientRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  status: string
}

function firstName(displayName: string): string {
  const p = displayName.trim().split(/\s+/)[0]
  return p || 'Coach'
}

function sessionStripColor(sessionType: string | null | undefined): string {
  const t = (sessionType ?? 'video').toLowerCase()
  if (t.includes('phone')) return 'var(--warning)'
  if (t.includes('person') || t.includes('in_person') || t.includes('in-person')) return 'var(--success)'
  return 'var(--accent)'
}

function personName(first: string | null, last: string | null, fallback = 'Client') {
  const n = [first, last].filter(Boolean).join(' ').trim()
  return n || fallback
}

function AttentionDot({ color }: { color: string }) {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full"
      style={{ background: color, width: 6, height: 6 }}
      aria-hidden
    />
  )
}

function ActivityDot({ kind }: { kind: string }) {
  let color = 'var(--text-quaternary)'
  if (kind === 'module_completed') color = 'var(--accent)'
  else if (kind === 'program_started') color = 'var(--success)'
  return <span className="size-[7px] shrink-0 rounded-full" style={{ background: color }} aria-hidden />
}

export function CoachDashboardContent({ coachDisplayName }: { coachDisplayName: string }) {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [weekSessions, setWeekSessions] = useState<SessionRow[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [storage, setStorage] = useState<StorageStrip | null>(null)
  const [attention, setAttention] = useState<AttentionPayload>(EMPTY_ATTENTION)
  const [checkinAlerts, setCheckinAlerts] = useState<CheckinAlertsPayload>({
    lowMood: [],
    missedCheckin: [],
  })
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasFetchError, setHasFetchError] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false)
  const [invoiceToast, setInvoiceToast] = useState<string | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [onboardingStorageReady, setOnboardingStorageReady] = useState(false)

  useEffect(() => {
    try {
      setOnboardingDismissed(localStorage.getItem('clearpath_onboarding_v2_dismissed') === 'true')
    } catch {
      /* ignore */
    }
    setOnboardingStorageReady(true)
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setHasFetchError(false)
    const now = new Date()
    const wkStart = startOfWeek(now, { weekStartsOn: 1 })
    const wkEnd = endOfWeek(now, { weekStartsOn: 1 })
    const weekQ = `?from=${encodeURIComponent(wkStart.toISOString())}&to=${encodeURIComponent(wkEnd.toISOString())}`
    try {
      const [sumRes, sessRes, weekSessRes, convRes, actRes, storRes, attRes, chkRes, clientsRes] = await Promise.all([
        fetch('/api/coach/dashboard-summary'),
        fetch('/api/coach/sessions'),
        fetch(`/api/coach/sessions${weekQ}`),
        fetch('/api/messages/conversations'),
        fetch('/api/coach/program-activity'),
        fetch('/api/coach/storage'),
        fetch('/api/coach/dashboard-attention'),
        fetch('/api/coach/checkins?alerts=true'),
        fetch('/api/clients?limit=10&status=active'),
      ])
      const anyFailed = ![sumRes, sessRes, weekSessRes, convRes, actRes, storRes, attRes, chkRes].every(
        (r) => r.ok
      )
      if (anyFailed) {
        setHasFetchError(true)
        console.error('Dashboard API partial failure', {
          dashboardSummary: sumRes.ok,
          sessions: sessRes.ok,
          weekSessions: weekSessRes.ok,
          conversations: convRes.ok,
          programActivity: actRes.ok,
          storage: storRes.ok,
          dashboardAttention: attRes.ok,
          checkinAlerts: chkRes.ok,
        })
      }
      const sumJson = await sumRes.json().catch(() => ({}))
      const sessJson = await sessRes.json().catch(() => ({}))
      const weekJson = await weekSessRes.json().catch(() => ({}))
      const convJson = await convRes.json().catch(() => ({}))
      const actJson = await actRes.json().catch(() => ({}))
      const storJson = await storRes.json().catch(() => ({}))
      const attJson = await attRes.json().catch(() => ({}))
      const chkJson = await chkRes.json().catch(() => ({}))
      if (sumJson.data) setSummary(sumJson.data)
      if (Array.isArray(sessJson.data)) setSessions(sessJson.data)
      if (Array.isArray(weekJson.data)) setWeekSessions(weekJson.data)
      else setWeekSessions([])
      if (Array.isArray(convJson.data)) setConversations(convJson.data)
      else setConversations([])
      if (Array.isArray(actJson.data)) setActivity(actJson.data)
      if (attJson.data && typeof attJson.data === 'object') setAttention(attJson.data as AttentionPayload)
      else setAttention(EMPTY_ATTENTION)
      const chkData = chkJson.data as CheckinAlertsPayload | undefined
      if (
        chkRes.ok &&
        chkData &&
        Array.isArray(chkData.lowMood) &&
        Array.isArray(chkData.missedCheckin)
      ) {
        setCheckinAlerts({
          lowMood: chkData.lowMood,
          missedCheckin: chkData.missedCheckin,
        })
      } else {
        setCheckinAlerts({ lowMood: [], missedCheckin: [] })
      }
      if (storJson.data && typeof storJson.data.usedGb === 'number') {
        setStorage({
          usedGb: storJson.data.usedGb,
          maxGb: storJson.data.maxGb,
          pct: storJson.data.pct,
        })
      } else {
        setStorage(null)
      }
      const clientsJson = await clientsRes.json().catch(() => ({}))
      if (Array.isArray(clientsJson.data)) setClients(clientsJson.data as ClientRow[])
      else setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const todaySessions = useMemo(() => {
    const today = new Date()
    return sessions
      .filter((s) => {
        try {
          return isSameDay(parseISO(s.scheduled_time), today)
        } catch {
          return false
        }
      })
      .sort((a, b) => parseISO(a.scheduled_time).getTime() - parseISO(b.scheduled_time).getTime())
  }, [sessions])

  const weekDays = useMemo(() => {
    const now = new Date()
    return eachDayOfInterval({
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    })
  }, [])

  const sessionsByDayKey = useMemo(() => {
    const map = new Map<string, SessionRow[]>()
    for (const s of weekSessions) {
      if (!['pending', 'confirmed', 'completed'].includes(s.status)) continue
      try {
        const key = format(parseISO(s.scheduled_time), 'yyyy-MM-dd')
        const arr = map.get(key) ?? []
        arr.push(s)
        map.set(key, arr)
      } catch {
        /* skip */
      }
    }
    return map
  }, [weekSessions])

  const unreadMessagesTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0),
    [conversations]
  )

  const upcomingSessionsFiltered = useMemo(() => {
    const now = new Date()
    return sessions.filter((s) => {
      if (!['pending', 'confirmed'].includes(s.status)) return false
      try {
        return parseISO(s.scheduled_time).getTime() > now.getTime()
      } catch {
        return false
      }
    })
  }, [sessions])

  const upcomingToday = useMemo(() => {
    const now = new Date()
    return upcomingSessionsFiltered.filter((s) => {
      try {
        return isSameDay(parseISO(s.scheduled_time), now)
      } catch {
        return false
      }
    }).length
  }, [upcomingSessionsFiltered])

  const upcomingThisWeek = useMemo(() => {
    const now = new Date()
    const wkStart = startOfWeek(now, { weekStartsOn: 1 })
    const wkEnd = endOfWeek(now, { weekStartsOn: 1 })
    return upcomingSessionsFiltered.filter((s) => {
      try {
        const t = parseISO(s.scheduled_time)
        if (isSameDay(t, now)) return false
        return t >= wkStart && t <= wkEnd
      } catch {
        return false
      }
    }).length
  }, [upcomingSessionsFiltered])

  const activityPreview = useMemo(() => activity.slice(0, 5), [activity])

  const conversationsPreview = useMemo(() => conversations.slice(0, 5), [conversations])

  const revenueMoMPct = useMemo(() => {
    const last = summary?.revenuePrevMonthCents ?? 0
    const cur = summary?.revenueMonthCents ?? 0
    if (last <= 0) return null
    return Math.round(((cur - last) / last) * 100)
  }, [summary?.revenueMonthCents, summary?.revenuePrevMonthCents])

  const attentionHasItems = useMemo(() => {
    const checkinCount = checkinAlerts.lowMood.length + checkinAlerts.missedCheckin.length
    return (
      attention.inactive.length +
        attention.overdue.length +
        attention.unpaidInvoices.length +
        attention.nearComplete.length +
        checkinCount >
      0
    )
  }, [attention, checkinAlerts])

  useEffect(() => {
    if (!invoiceToast) return
    const t = window.setTimeout(() => setInvoiceToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [invoiceToast])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const coachFirst = firstName(coachDisplayName)
  const heroDateLine = format(new Date(), 'EEEE, MMMM d')
  const sessionsTodayLine = `${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} today`

  const totalClients = summary?.activeClientsCount ?? 0
  const upcomingCount = upcomingSessionsFiltered.length
  const messagesSentCount = summary?.coachMessagesSentCount ?? 0
  const clientsAddedThisMonth = summary?.clientsAddedThisMonth ?? 0
  const pendingInvoices = summary?.pendingInvoicesCount ?? 0

  const onboardingChecklist = useMemo(
    () => [
      { done: true, label: 'Create your account', href: null as string | null },
      { done: totalClients > 0, label: 'Add your first client', href: '/coach/clients' as const },
      { done: upcomingCount > 0, label: 'Book your first session', href: '/coach/schedule' as const },
      { done: messagesSentCount > 0, label: 'Send your first message', href: '/coach/messages' as const },
    ],
    [totalClients, upcomingCount, messagesSentCount]
  )

  const onboardingCompletedCount = onboardingChecklist.filter((i) => i.done).length
  const showNewCoachOnboarding =
    onboardingStorageReady &&
    !onboardingDismissed &&
    onboardingCompletedCount < 4 &&
    totalClients === 0 &&
    upcomingCount === 0

  function dismissOnboarding() {
    try {
      localStorage.setItem('clearpath_onboarding_v2_dismissed', 'true')
    } catch {
      /* ignore */
    }
    setOnboardingDismissed(true)
  }

  return (
    <div className="min-h-full w-full bg-[var(--bg-app)]">

      {/* ── MOBILE LAYOUT (hidden on lg+) ── */}
      <div className="lg:hidden px-4 pt-4 pb-20">

        {/* Section 1 — Compact greeting bar */}
        <div className="mb-3">
          <p className="section-label-got">{heroDateLine}</p>
          <h1 className="font-display text-[22px] font-medium tracking-[0.01em] text-[var(--text-primary)] leading-tight mt-1">
            {greeting}, {coachFirst}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            {loading ? 'Loading…' : sessionsTodayLine}
          </p>
        </div>

        {/* Section 2 — Alert strip */}
        {attentionHasItems || checkinAlerts.lowMood.length > 0 || checkinAlerts.missedCheckin.length > 0 ? (
          <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {checkinAlerts.lowMood.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                ⚠ {checkinAlerts.lowMood.length} low mood
              </span>
            ) : null}
            {checkinAlerts.missedCheckin.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                {checkinAlerts.missedCheckin.length} missed check-in
              </span>
            ) : null}
            {attention.overdue.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--error-bg, #fef2f2)', color: 'var(--error)' }}>
                {attention.overdue.length} overdue tasks
              </span>
            ) : null}
            {attention.unpaidInvoices.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                ${attention.unpaidInvoices.length} unpaid
              </span>
            ) : null}
            {attention.inactive.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                {attention.inactive.length} inactive
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Section 3 — Today's sessions (compact card) */}
        <div className="mb-3 overflow-hidden rounded-[12px] border border-[var(--border-default)]" style={{ background: 'var(--bg-subtle)' }}>
          <div className="flex h-9 items-center justify-between border-b border-[var(--border-subtle)] px-3">
            <span className="section-label-got">Today</span>
            <Link href="/coach/schedule" className="text-[12px] font-medium text-[var(--got-gold)]">Schedule →</Link>
          </div>
          {todaySessions.length === 0 ? (
            <div className="flex items-center justify-between px-3 py-3">
              <p className="text-[13px] text-[var(--text-tertiary)]">No sessions today</p>
              <Button variant="ghost" size="sm" type="button" onClick={() => router.push('/coach/schedule')}>Book one</Button>
            </div>
          ) : (
            <ul>
              {todaySessions.slice(0, 3).map(s => (
                <li key={s.id}>
                  <button type="button" onClick={() => router.push('/coach/schedule')}
                    className="flex h-11 w-full items-center gap-2.5 px-3 text-left hover:bg-[var(--bg-muted)]">
                    <span className="w-[48px] shrink-0 text-[11px] text-[var(--text-tertiary)]">{format(parseISO(s.scheduled_time), 'h:mm a')}</span>
                    <span className="shrink-0 h-6 w-[3px] rounded-full" style={{ background: sessionStripColor(s.session_type) }} aria-hidden />
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {[s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--text-quaternary)]">{sessionTypeLabel(s.session_type)}</span>
                  </button>
                </li>
              ))}
              {todaySessions.length > 3 ? (
                <li className="border-t border-[var(--border-subtle)] px-3 py-2">
                  <Link href="/coach/schedule" className="text-[12px] text-[var(--cp-accent)]">+{todaySessions.length - 3} more sessions →</Link>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {/* Section 4 — Stat+action tiles (3-col grid, shows actual stats) */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            {
              label: 'Clients',
              value: `${totalClients}`,
              sub: clientsAddedThisMonth > 0 ? `+${clientsAddedThisMonth} new` : 'active',
              href: '/coach/clients',
              bg: 'var(--accent-light)',
              color: 'var(--accent)',
              icon: <Users className="size-5" />,
              badge: 0,
            },
            {
              label: 'Schedule',
              value: `${summary?.sessionsThisWeek ?? 0}`,
              sub: upcomingToday > 0 ? `${upcomingToday} today` : 'this week',
              href: '/coach/schedule',
              bg: 'var(--success-bg)',
              color: 'var(--success)',
              icon: <CalendarDays className="size-5" />,
              badge: 0,
            },
            {
              label: 'Messages',
              value: unreadMessagesTotal > 0 ? `${unreadMessagesTotal}` : '—',
              sub: unreadMessagesTotal > 0 ? 'unread' : 'All read',
              href: '/coach/messages',
              bg: unreadMessagesTotal > 0 ? 'var(--accent-light)' : 'var(--bg-muted)',
              color: unreadMessagesTotal > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
              icon: <MessageSquare className="size-5" />,
              badge: unreadMessagesTotal,
            },
            {
              label: 'Revenue',
              value: formatCents(summary?.revenueMonthCents ?? 0),
              sub: revenueMoMPct !== null
                ? `${revenueMoMPct >= 0 ? '↑' : '↓'}${Math.abs(revenueMoMPct)}%`
                : 'this month',
              href: '/coach/invoices',
              bg: 'color-mix(in srgb, var(--success) 12%, var(--bg-muted))',
              color: 'var(--success)',
              icon: <TrendingUp className="size-5" />,
              badge: 0,
            },
            {
              label: 'Invoices',
              value: pendingInvoices > 0 ? `${pendingInvoices}` : '—',
              sub: pendingInvoices > 0 ? 'pending' : 'All paid',
              href: '/coach/invoices',
              bg: pendingInvoices > 0 ? 'var(--warning-bg)' : 'var(--bg-muted)',
              color: pendingInvoices > 0 ? 'var(--warning)' : 'var(--text-tertiary)',
              icon: <CreditCard className="size-5" />,
              badge: pendingInvoices > 0 ? pendingInvoices : 0,
            },
            {
              label: 'New client',
              value: '+',
              sub: 'Add client',
              href: '/coach/clients',
              bg: 'var(--accent)',
              color: 'white',
              icon: <Plus className="size-5" />,
              badge: 0,
            },
          ].map(item => (
            <button
              key={item.href + item.label}
              type="button"
              onClick={() => router.push(item.href)}
              className="relative flex flex-col items-center gap-1 rounded-[12px] border border-[var(--border-default)] py-3.5 px-2 transition-all duration-100 active:scale-[0.97]"
              style={{ background: 'var(--bg-subtle)' }}
            >
              {item.badge > 0 ? (
                <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">{item.badge}</span>
              ) : null}
              <span className="flex size-9 items-center justify-center rounded-full" style={{ background: item.bg, color: item.color }}>
                {item.icon}
              </span>
              <span className="mt-1 text-[18px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">{item.value}</span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">{item.label}</span>
              <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">{item.sub}</span>
            </button>
          ))}
        </div>

      </div>
      {/* ── END MOBILE LAYOUT ── */}

      {/* ── DESKTOP LAYOUT (hidden below lg) ── */}
      <div className="coach-page hidden lg:block">
      <div className="coach-page-inner coach-dash-stagger">

        {/* Error banner */}
        {hasFetchError && (
          <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-[13px] text-[var(--warning)]">
            <span>Some data could not load.</span>
            <button type="button" onClick={() => void loadDashboard()} className="ml-auto text-[12px] font-medium underline">Retry</button>
          </div>
        )}

        {/* ── Hero: greeting + quick actions ── */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="game-stat__label mb-1">{heroDateLine}</p>
            <h1 className="game-page-title">{greeting}, {coachFirst}</h1>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              {loading ? 'Loading...' : sessionsTodayLine}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => router.push('/coach/schedule')}>
              Book session
            </Button>
            <Button variant="primary" size="sm" type="button" onClick={() => router.push('/coach/clients')}>
              + Add client
            </Button>
          </div>
        </div>

        {/* ── HUD stat bar (like GoT rewards: Essence / Honor / Gear) ── */}
        <div className="mb-6 grid grid-cols-3 gap-3 xl:grid-cols-6">
          {loading && !summary ? (
            Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="game-stat animate-pulse">
                <div className="h-6 w-16 rounded bg-[var(--bg-muted)]" />
                <div className="h-3 w-12 rounded bg-[var(--bg-muted)]" />
              </div>
            ))
          ) : (
            <>
              <button type="button" onClick={() => router.push('/coach/clients')} className="game-stat text-left">
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  <Users className="size-4" strokeWidth={2} />
                </span>
                <span className="game-stat__value">{totalClients}</span>
                <span className="game-stat__label">Clients</span>
                <span className="game-stat__sub">{clientsAddedThisMonth > 0 ? `+${clientsAddedThisMonth} new` : 'active'}</span>
              </button>
              <button type="button" onClick={() => router.push('/coach/schedule')} className="game-stat text-left">
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                  <CalendarDays className="size-4" strokeWidth={2} />
                </span>
                <span className="game-stat__value">{summary?.sessionsThisWeek ?? 0}</span>
                <span className="game-stat__label">Sessions</span>
                <span className="game-stat__sub">{upcomingToday > 0 ? `${upcomingToday} today` : 'this week'}</span>
              </button>
              <button type="button" onClick={() => router.push('/coach/messages')} className="game-stat text-left">
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: unreadMessagesTotal > 0 ? 'var(--accent-light)' : 'var(--bg-muted)', color: unreadMessagesTotal > 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                  <MessageSquare className="size-4" strokeWidth={2} />
                </span>
                <span className="game-stat__value">{unreadMessagesTotal > 0 ? unreadMessagesTotal : '—'}</span>
                <span className="game-stat__label">Messages</span>
                <span className="game-stat__sub">{unreadMessagesTotal > 0 ? 'unread' : 'All read'}</span>
              </button>
              <button type="button" onClick={() => router.push('/coach/invoices')} className="game-stat text-left">
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 12%, var(--bg-muted))', color: 'var(--success)' }}>
                  <TrendingUp className="size-4" strokeWidth={2} />
                </span>
                <span className="game-stat__value">{formatCents(summary?.revenueMonthCents ?? 0)}</span>
                <span className="game-stat__label">Revenue</span>
                <span className="game-stat__sub">{revenueMoMPct !== null ? `${revenueMoMPct >= 0 ? '↑' : '↓'} ${Math.abs(revenueMoMPct)}%` : 'this month'}</span>
              </button>
              <button type="button" onClick={() => router.push('/coach/invoices')} className="game-stat text-left">
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: pendingInvoices > 0 ? 'var(--warning-bg)' : 'var(--bg-muted)', color: pendingInvoices > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                  <CreditCard className="size-4" strokeWidth={2} />
                </span>
                <span className="game-stat__value">{pendingInvoices > 0 ? pendingInvoices : '—'}</span>
                <span className="game-stat__label">Invoices</span>
                <span className="game-stat__sub">{pendingInvoices > 0 ? 'pending' : 'All paid'}</span>
              </button>
              <button type="button" onClick={() => router.push('/coach/programs')} className="game-stat text-left">
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, #a855f7 18%, var(--bg-muted))', color: '#a855f7' }}>
                  <BookOpen className="size-4" strokeWidth={2} />
                </span>
                <span className="game-stat__value">→</span>
                <span className="game-stat__label">Programs</span>
                <span className="game-stat__sub">Manage content</span>
              </button>
            </>
          )}
        </div>

        {/* ── Main 2-column grid ── */}
        <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">

          {/* LEFT COLUMN */}
          <div className="min-w-0 space-y-4">

            {/* Command bar moved to hero above */}

            {/* ── Onboarding checklist (new coaches only) ── */}
            {showNewCoachOnboarding ? (
              <div
                className="relative mb-5 shrink-0 rounded-[var(--radius-lg)] border border-[var(--accent-muted)] px-6 py-5"
                style={{ background: 'var(--accent-light)' }}
              >
                <button
                  type="button"
                  onClick={dismissOnboarding}
                  className="absolute right-4 top-4 text-[12px] font-medium text-[var(--text-tertiary)] underline-offset-2 transition-colors hover:text-[var(--text-primary)] hover:underline"
                >
                  Skip this
                </button>
                <div className="flex flex-wrap items-start justify-between gap-2 pr-16">
                  <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Get started with ClearPath</h2>
                  <span className="text-[13px] font-medium text-[var(--accent)]">
                    {onboardingCompletedCount} of 4 complete
                  </span>
                </div>
                <div
                  className="my-3 h-1 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--accent-muted)' }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ background: 'var(--accent)', width: `${(onboardingCompletedCount / 4) * 100}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-0">
                  {onboardingChecklist.map((item) => (
                    <li
                      key={item.label}
                      className="flex h-9 items-center justify-between gap-2 border-b border-[var(--border-subtle)] last:border-b-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {item.done ? (
                          <span
                            className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[var(--text-on-accent)]"
                            style={{ background: 'var(--accent)' }}
                            aria-hidden
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        ) : (
                          <span
                            className="size-[22px] shrink-0 rounded-full border border-[var(--border-default)] bg-transparent"
                            aria-hidden
                          />
                        )}
                        <span
                          className={cn(
                            'text-[14px]',
                            item.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                      {!item.done && item.href ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 min-h-0 shrink-0 px-2 text-[var(--text-primary)]"
                          aria-label={`Go to ${item.label}`}
                          onClick={() => router.push(item.href!)}
                        >
                          →
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* ── Week strip + Today's sessions ── */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
              <div className="game-panel">
                <div className="game-panel-header">
                  <span className="game-panel-header__title">This week</span>
                  <Link href="/coach/schedule" className="link-nav text-[12px] font-medium">View calendar →</Link>
                </div>
                <div
                  className="grid p-3"
                  style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}
                >
                  {weekDays.map((d) => {
                    const key = format(d, 'yyyy-MM-dd')
                    const daySessions = sessionsByDayKey.get(key) ?? []
                    const isToday = isSameDay(d, new Date())
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => router.push('/coach/schedule')}
                        className={cn(
                          'cursor-pointer rounded-[8px] px-1 py-2 text-center transition-colors duration-100',
                          isToday
                            ? 'border border-[rgba(196,164,74,0.2)] bg-[rgba(196,164,74,0.06)]'
                            : 'border border-transparent hover:bg-[var(--bg-muted)]'
                        )}
                      >
                        <div className="text-[9px] font-semibold uppercase text-[var(--text-tertiary)]">
                          {format(d, 'EEE')}
                        </div>
                        <div
                          className={cn(
                            'mt-0.5 text-[17px] font-bold leading-none',
                            isToday ? 'text-[var(--got-gold)]' : 'text-[var(--text-primary)]'
                          )}
                        >
                          {format(d, 'd')}
                        </div>
                        <div className="mt-1 flex min-h-[10px] flex-wrap justify-center gap-0.5">
                          {daySessions.slice(0, 5).map((s) => (
                            <span
                              key={s.id}
                              className="size-[5px] shrink-0 rounded-full"
                              style={{ background: sessionStripColor(s.session_type) }}
                              aria-hidden
                            />
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="game-panel flex min-h-0 flex-col">
                <div className="game-panel-header">
                  <span className="game-panel-header__title">Today&apos;s sessions</span>
                  <span className="ml-2 text-[12px] font-medium text-[var(--text-secondary)]">
                    ({todaySessions.length})
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  {loading ? (
                    <ul className="space-y-0 p-2">
                      {[1, 2, 3].map((i) => (
                        <li key={i} className="skeleton mb-2 h-12 rounded-[var(--radius-md)]" />
                      ))}
                    </ul>
                  ) : todaySessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8">
                      <p className="text-[13px] text-[var(--text-tertiary)]">No sessions today</p>
                      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => router.push('/coach/schedule')}>
                        Book a session
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {todaySessions.map((s) => {
                        const start = parseISO(s.scheduled_time)
                        const name =
                          [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'
                        const now = new Date()
                        const minsUntil = differenceInMinutes(start, now)
                        const soon = start > now && minsUntil > 0 && minsUntil < 120
                        const hrs = differenceInHours(start, now)
                        const bar = sessionStripColor(s.session_type)
                        const typeLabel = sessionTypeLabel(s.session_type)
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => router.push(`/coach/schedule?session=${s.id}`)}
                              className="flex h-12 w-full items-center gap-2.5 px-3.5 text-left transition-colors hover:bg-[var(--bg-muted)]"
                              style={{ minHeight: 48, paddingLeft: 14, paddingRight: 14 }}
                            >
                              <span className="w-[52px] shrink-0 text-[11px] text-[var(--text-tertiary)]">
                                {format(start, 'h:mm a')}
                              </span>
                              <span
                                className="shrink-0 rounded-sm"
                                style={{ width: 3, height: 30, borderRadius: 2, background: bar }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-medium text-[var(--text-primary)]">{name}</span>
                                <span className="block text-[11px] text-[var(--text-tertiary)]">{typeLabel}</span>
                              </span>
                              <span className="shrink-0">
                                {soon ? (
                                  <span
                                    className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                                    style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                                  >
                                    Soon
                                  </span>
                                ) : start > now ? (
                                  <span className="rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                                    {hrs >= 1 ? `${hrs}h` : `${Math.max(1, minsUntil)}m`}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-[var(--text-quaternary)]">Done</span>
                                )}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stat tiles moved to HUD bar above ── */}
            <div className="hidden">
              {loading && !summary ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-[80px] w-full rounded-[8px]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Clients',
                      value: `${totalClients}`,
                      sub: clientsAddedThisMonth > 0 ? `+${clientsAddedThisMonth} this month` : 'active',
                      href: '/coach/clients',
                      bg: 'var(--accent-light)',
                      color: 'var(--accent)',
                      icon: <Users className="size-4" strokeWidth={2} />,
                      badge: 0,
                    },
                    {
                      label: 'Sessions/wk',
                      value: `${summary?.sessionsThisWeek ?? 0}`,
                      sub: upcomingToday > 0 ? `${upcomingToday} today` : upcomingThisWeek > 0 ? `${upcomingThisWeek} this week` : 'None today',
                      href: '/coach/schedule',
                      bg: 'var(--success-bg)',
                      color: 'var(--success)',
                      icon: <CalendarDays className="size-4" strokeWidth={2} />,
                      badge: 0,
                    },
                    {
                      label: 'Messages',
                      value: unreadMessagesTotal > 0 ? `${unreadMessagesTotal}` : '—',
                      sub: unreadMessagesTotal > 0 ? 'unread' : 'All read',
                      href: '/coach/messages',
                      bg: unreadMessagesTotal > 0 ? 'var(--accent-light)' : 'var(--bg-muted)',
                      color: unreadMessagesTotal > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                      icon: <MessageSquare className="size-4" strokeWidth={2} />,
                      badge: unreadMessagesTotal,
                    },
                    {
                      label: 'Revenue/mo',
                      value: formatCents(summary?.revenueMonthCents ?? 0),
                      sub: revenueMoMPct !== null
                        ? `${revenueMoMPct >= 0 ? '↑' : '↓'} ${Math.abs(revenueMoMPct)}% vs last mo`
                        : (summary?.revenueMonthCents ?? 0) > 0 ? 'this month' : 'No payments yet',
                      href: '/coach/invoices',
                      bg: 'color-mix(in srgb, var(--success) 12%, var(--bg-muted))',
                      color: 'var(--success)',
                      icon: <TrendingUp className="size-4" strokeWidth={2} />,
                      badge: 0,
                    },
                    {
                      label: 'Invoices',
                      value: pendingInvoices > 0 ? `${pendingInvoices}` : '—',
                      sub: pendingInvoices > 0 ? 'pending payment' : 'All paid',
                      href: '/coach/invoices',
                      bg: pendingInvoices > 0 ? 'var(--warning-bg)' : 'var(--bg-muted)',
                      color: pendingInvoices > 0 ? 'var(--warning)' : 'var(--text-tertiary)',
                      icon: <CreditCard className="size-4" strokeWidth={2} />,
                      badge: pendingInvoices > 0 ? pendingInvoices : 0,
                    },
                    {
                      label: 'Programs',
                      value: '→',
                      sub: 'Manage content',
                      href: '/coach/programs',
                      bg: 'color-mix(in srgb, #a855f7 18%, var(--bg-muted))',
                      color: '#a855f7',
                      icon: <BookOpen className="size-4" strokeWidth={2} />,
                      badge: 0,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => router.push(item.href)}
                      className="game-stat relative text-left"
                    >
                      {item.badge > 0 ? (
                        <span
                          className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                          style={{ background: 'var(--got-gold)', color: 'var(--got-ink)' }}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: item.bg, color: item.color }}
                      >
                        {item.icon}
                      </span>
                      <span className="game-stat__value">
                        {item.value}
                      </span>
                      <span className="game-stat__label">
                        {item.label}
                      </span>
                      <span
                        className="block truncate text-[11px] leading-tight"
                        style={{ color: item.badge > 0 ? item.color : 'var(--text-tertiary)' }}
                      >
                        {item.sub}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setQuickInvoiceOpen(true)}>
                  Quick invoice
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentModalOpen(true)}>
                  Record payment
                </Button>
              </div>
            </div>

          </div>
          {/* END LEFT COLUMN */}

          {/* RIGHT COLUMN */}
          <div className="xl:sticky xl:top-0 xl:max-h-[calc(100dvh-var(--nav-height))] xl:overflow-y-auto">
            <div className="flex flex-col gap-3 pb-4">

              {/* Attention panel */}
              <div className="game-panel">
                <div className="game-panel-header">
                  <span className="game-panel-header__title">
                    {attentionHasItems ? 'Needs attention' : 'All clear'}
                  </span>
                </div>
                <div className="px-0 py-1">
                  {!loading && attentionHasItems ? (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {attention.inactive.map((row) => {
                        const name = personName(row.firstName, row.lastName)
                        const quietDays = row.lastMessageAt
                          ? differenceInCalendarDays(new Date(), parseISO(row.lastMessageAt))
                          : null
                        const quietLabel =
                          quietDays === null ? 'over 7 days' : `${quietDays} day${quietDays === 1 ? '' : 's'}`
                        return (
                          <li
                            key={`i-${row.clientId}`}
                            className="flex min-h-[44px] items-center gap-2.5 px-3.5 py-2"
                            style={{ padding: '8px 14px', gap: 10 }}
                          >
                            <AttentionDot color="var(--text-quaternary)" />
                            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-primary)]">
                              <strong className="font-medium">{name}</strong> — quiet {quietLabel}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                type="button"
                                className="h-7 min-h-[28px] px-2 text-[12px]"
                                onClick={() =>
                                  router.push(`/coach/messages?clientId=${encodeURIComponent(row.clientId)}`)
                                }
                              >
                                Message
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                      {checkinAlerts.lowMood.map((row) => {
                        const name = personName(row.firstName, row.lastName)
                        return (
                          <li
                            key={`cm-low-${row.clientId}`}
                            className="flex min-h-[44px] items-center gap-2.5 px-3.5 py-2"
                            style={{ padding: '8px 14px', gap: 10 }}
                          >
                            <AttentionDot color="var(--warning)" />
                            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-primary)]">
                              <strong className="font-medium">{name}</strong> — low mood {row.consecutiveLowDays}d
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              className="h-7 min-h-[28px] px-2 text-[12px]"
                              onClick={() =>
                                router.push(`/coach/messages?clientId=${encodeURIComponent(row.clientId)}`)
                              }
                            >
                              Message
                            </Button>
                          </li>
                        )
                      })}
                      {checkinAlerts.missedCheckin.map((row) => {
                        const name = personName(row.firstName, row.lastName)
                        return (
                          <li
                            key={`cm-miss-${row.clientId}`}
                            className="flex min-h-[44px] items-center gap-2.5 px-3.5 py-2"
                            style={{ padding: '8px 14px', gap: 10 }}
                          >
                            <AttentionDot color="var(--text-quaternary)" />
                            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-primary)]">
                              <strong className="font-medium">{name}</strong> — no check-in {row.daysSinceCheckin}d
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              className="h-7 min-h-[28px] px-2 text-[12px]"
                              onClick={() =>
                                router.push(`/coach/messages?clientId=${encodeURIComponent(row.clientId)}`)
                              }
                            >
                              Follow up
                            </Button>
                          </li>
                        )
                      })}
                      {attention.overdue.map((row) => {
                        const name = personName(row.firstName, row.lastName)
                        const title = row.templateTitle?.trim() || 'Assignment'
                        return (
                          <li
                            key={`o-${row.id}`}
                            className="flex min-h-[44px] items-center gap-2.5 px-3.5 py-2"
                            style={{ padding: '8px 14px', gap: 10 }}
                          >
                            <AttentionDot color="var(--accent)" />
                            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-primary)]">
                              <strong className="font-medium">{name}</strong> — overdue: {title}
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              className="h-7 min-h-[28px] px-2 text-[12px]"
                              onClick={() => router.push('/coach/assignments?tab=overdue')}
                            >
                              Review
                            </Button>
                          </li>
                        )
                      })}
                      {attention.unpaidInvoices.map((row) => {
                        const name = personName(row.firstName, row.lastName)
                        const daysOld = differenceInCalendarDays(new Date(), parseISO(row.createdAt))
                        return (
                          <li
                            key={`u-${row.id}`}
                            className="flex min-h-[44px] items-center gap-2.5 px-3.5 py-2"
                            style={{ padding: '8px 14px', gap: 10 }}
                          >
                            <AttentionDot color="var(--warning)" />
                            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-primary)]">
                              <strong className="font-medium">{name}</strong> — unpaid ({daysOld}d)
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              className="h-7 min-h-[28px] px-2 text-[12px]"
                              onClick={() =>
                                router.push(`/coach/messages?clientId=${encodeURIComponent(row.clientId)}`)
                              }
                            >
                              Follow up
                            </Button>
                          </li>
                        )
                      })}
                      {attention.nearComplete.map((row) => {
                        const name = personName(row.firstName, row.lastName)
                        const pct = Math.round((row.completionRatio ?? 0) * 100)
                        return (
                          <li
                            key={`n-${row.clientId}-${row.programTitle}`}
                            className="flex min-h-[44px] items-center gap-2.5 px-3.5 py-2"
                            style={{ padding: '8px 14px', gap: 10 }}
                          >
                            <AttentionDot color="var(--success)" />
                            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-primary)]">
                              <strong className="font-medium">{name}</strong> — {pct}% through{' '}
                              {row.programTitle?.trim() || 'program'}
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              className="h-7 min-h-[28px] px-2 text-[12px]"
                              onClick={() => router.push(`/coach/clients/${encodeURIComponent(row.clientId)}`)}
                            >
                              View
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : !loading ? (
                    <div className="px-3.5 py-5 text-center">
                      <span
                        className="mx-auto mb-2.5 flex size-9 items-center justify-center rounded-full"
                        style={{ background: 'var(--success-bg)' }}
                        aria-hidden
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <p className="text-[13px] font-semibold text-[var(--success)]">All clients on track</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">Nothing needs your attention.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
                      <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Conversations */}
              <div className="game-panel">
                <div className="game-panel-header">
                  <span className="game-panel-header__title">Conversations</span>
                  <Link href="/coach/messages" className="link-nav text-[12px] font-medium">
                    View all →
                  </Link>
                </div>
                <div className="py-1">
                  {loading ? (
                    <div className="space-y-2 p-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-md)]" />
                      ))}
                    </div>
                  ) : conversationsPreview.length === 0 ? (
                    <p className="px-3.5 py-6 text-center text-[13px] text-[var(--text-tertiary)]">No conversations yet</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {conversationsPreview.map((conv) => (
                        <li key={conv.clientId}>
                          <button
                            type="button"
                            onClick={() => router.push(`/coach/messages?clientId=${encodeURIComponent(conv.clientId)}`)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--bg-muted)]"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="block text-[13px] font-medium text-[var(--text-primary)] truncate">
                                  {conv.fullName}
                                </span>
                                {conv.unreadCount > 0 ? (
                                  <span
                                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                    style={{ background: 'var(--got-gold)', color: 'var(--got-ink)', lineHeight: 1.4 }}
                                  >
                                    {conv.unreadCount}
                                  </span>
                                ) : null}
                              </span>
                              <span className="block text-[11px] text-[var(--text-tertiary)] truncate">
                                {conv.lastMessagePreview || 'No messages yet'}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--text-quaternary)] whitespace-nowrap">
                              {formatDistanceToNow(parseISO(conv.lastMessageAt), { addSuffix: true })}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div className="game-panel">
                <div className="game-panel-header">
                  <span className="game-panel-header__title">Recent activity</span>
                  <Link href="/coach/programs" className="link-nav text-[12px] font-medium">
                    View all
                  </Link>
                </div>
                <div className="py-1">
                  {loading ? (
                    <div className="space-y-2 p-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-9 w-full rounded-[var(--radius-md)]" />
                      ))}
                    </div>
                  ) : activityPreview.length === 0 ? (
                    <p className="px-3.5 py-8 text-center text-[13px] text-[var(--text-tertiary)]">No recent activity</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {activityPreview.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-start gap-2.5 px-3.5 py-2.5"
                          style={{ padding: '9px 14px' }}
                        >
                          <span className="mt-1.5">
                            <ActivityDot kind={row.kind} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-[var(--text-primary)]">{row.summary}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--text-quaternary)]">
                              {formatDistanceToNow(parseISO(row.at), { addSuffix: true })}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="border-t border-[var(--border-subtle)] px-3.5 py-2 text-center text-[11px] text-[var(--text-quaternary)]">
                  Last updated {format(new Date(), 'MMM d, h:mm a')}
                </p>
              </div>

              {/* Storage strip */}
              {storage ? (
                <div className="game-panel px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="game-panel-header__title">Storage</span>
                    <span className="text-[12px] text-[var(--text-tertiary)]">
                      {storage.usedGb.toFixed(1)} / {storage.maxGb} GB
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        storage.pct >= 95
                          ? 'bg-[var(--error)]'
                          : storage.pct >= 80
                            ? 'bg-[var(--warning)]'
                            : 'bg-[var(--accent)]'
                      )}
                      style={{ width: `${Math.min(100, storage.pct)}%` }}
                    />
                  </div>
                </div>
              ) : null}

            </div>
          </div>
          {/* END RIGHT COLUMN */}

        </div>
        {/* END 2-column grid */}

      </div>
      </div>
      {/* ── END DESKTOP LAYOUT ── */}

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onRecorded={() => {
          void refreshAll()
        }}
      />

      <QuickInvoiceModal
        open={quickInvoiceOpen}
        onClose={() => setQuickInvoiceOpen(false)}
        onSent={(name) => {
          setInvoiceToast(`Invoice sent to ${name}`)
          void refreshAll()
        }}
      />

      {invoiceToast ? (
        <div role="status" aria-live="polite" className="toast-coach flex items-center gap-2">
          <span className="text-[var(--success)]" aria-hidden>
            ✓
          </span>
          {invoiceToast}
        </div>
      ) : null}
    </div>
  )
}
