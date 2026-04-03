'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { Calendar, CreditCard, MessageSquare, Users } from 'lucide-react'
import { QuickInvoiceModal } from '@/components/coach/QuickInvoiceModal'
import { RecordPaymentModal } from '@/components/coach/RecordPaymentModal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CountUpValue } from '@/components/ui/CountUpValue'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatTrendLabel } from '@/lib/dashboard-trends'
import { formatCents } from '@/lib/format-currency'
import { cn } from '@/lib/utils'

type SessionRow = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
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

function firstName(displayName: string): string {
  const p = displayName.trim().split(/\s+/)[0]
  return p || 'Coach'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase().slice(0, 2) || '?'
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function activityIcon(kind: string) {
  if (kind === 'module_completed') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-[var(--accent)]"
        aria-hidden
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4 12 14.01l-3-3" />
      </svg>
    )
  }
  if (kind === 'program_started') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-[var(--accent)]"
        aria-hidden
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    )
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-[var(--accent)]"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function StatCardGhost({
  label,
  value,
  icon,
  trendUp,
  trendLabel,
  formatter,
  footer,
  subtitle,
  href,
  animateOnce,
}: {
  label: string
  value: number
  icon: React.ReactNode
  trendUp?: boolean
  trendLabel?: string
  formatter?: (value: number) => string
  footer?: React.ReactNode
  subtitle?: React.ReactNode
  href?: string
  animateOnce?: boolean
}) {
  const inner = (
    <Card
      variant="ghost"
      padding="default"
      className={cn(
        'border border-[var(--border-default)] bg-[var(--bg-app)] shadow-[var(--shadow-xs)]',
        'p-5',
        href && 'card-interactive h-full border-[var(--border-default)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-tertiary)] [&_svg]:block">
          {icon}
        </span>
        {trendLabel ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-[var(--radius-full)] px-2 py-[3px] text-[11px] font-semibold',
              trendUp === true && 'bg-[var(--success-bg)] text-[var(--success)]',
              trendUp === false && 'bg-[var(--error-bg)] text-[var(--error)]',
              trendUp === undefined && 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
            )}
            title="vs last week"
          >
            {trendUp === true ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : trendUp === false ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            {trendLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[36px] font-bold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
        {formatter ? (
          <CountUpValue value={value} formatter={formatter} durationMs={600} animateOnce={animateOnce ?? false} />
        ) : (
          <CountUpValue value={value} durationMs={600} animateOnce={animateOnce ?? false} />
        )}
      </p>
      <p className="mt-0.5 text-[13px] font-normal text-[var(--text-tertiary)]">{label}</p>
      {subtitle ? <p className="mt-0.5 text-[11px] font-normal text-[var(--text-quaternary)]">{subtitle}</p> : null}
      {footer}
    </Card>
  )
  if (href) {
    return (
      <Link href={href} className="block h-full min-h-0 no-underline">
        {inner}
      </Link>
    )
  }
  return inner
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-11 min-h-[44px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{title}</h2>
      {action}
    </div>
  )
}

function QuickAction({
  label,
  onClick,
  icon,
}: {
  label: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex h-16 min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)]',
        'bg-[var(--bg-subtle)] px-3 text-center text-[12px] font-medium text-[var(--text-tertiary)]',
        'transition-all duration-[150ms] ease-out',
        'hover:border-[var(--accent-muted)] hover:bg-[var(--accent-light)]'
      )}
    >
      <span className="text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent)] [&_svg]:size-5">
        {icon}
      </span>
      <span className="transition-colors group-hover:text-[var(--accent)]">{label}</span>
    </button>
  )
}

export function CoachDashboardContent({ coachDisplayName }: { coachDisplayName: string }) {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [storage, setStorage] = useState<StorageStrip | null>(null)
  const [attention, setAttention] = useState<AttentionPayload>(EMPTY_ATTENTION)
  const [checkinAlerts, setCheckinAlerts] = useState<CheckinAlertsPayload>({
    lowMood: [],
    missedCheckin: [],
  })
  const [loading, setLoading] = useState(true)
  const [hasFetchError, setHasFetchError] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false)
  const [invoiceToast, setInvoiceToast] = useState<string | null>(null)
  const [reEngageBusy, setReEngageBusy] = useState(false)
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
    try {
      const [sumRes, sessRes, convRes, actRes, storRes, attRes, chkRes] = await Promise.all([
        fetch('/api/coach/dashboard-summary'),
        fetch('/api/coach/sessions'),
        fetch('/api/messages/conversations'),
        fetch('/api/coach/program-activity'),
        fetch('/api/coach/storage'),
        fetch('/api/coach/dashboard-attention'),
        fetch('/api/coach/checkins?alerts=true'),
      ])
      const anyFailed = ![sumRes, sessRes, convRes, actRes, storRes, attRes, chkRes].every((r) => r.ok)
      if (anyFailed) {
        setHasFetchError(true)
        console.error('Dashboard API partial failure', {
          dashboardSummary: sumRes.ok,
          sessions: sessRes.ok,
          conversations: convRes.ok,
          programActivity: actRes.ok,
          storage: storRes.ok,
          dashboardAttention: attRes.ok,
          checkinAlerts: chkRes.ok,
        })
      }
      const sumJson = await sumRes.json().catch(() => ({}))
      const sessJson = await sessRes.json().catch(() => ({}))
      const convJson = await convRes.json().catch(() => ({}))
      const actJson = await actRes.json().catch(() => ({}))
      const storJson = await storRes.json().catch(() => ({}))
      const attJson = await attRes.json().catch(() => ({}))
      const chkJson = await chkRes.json().catch(() => ({}))
      if (sumJson.data) setSummary(sumJson.data)
      if (Array.isArray(sessJson.data)) setSessions(sessJson.data)
      if (Array.isArray(convJson.data)) setConversations(convJson.data)
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

  /** Next session today, starting within 2 hours — surfaced as the primary “do this now” cue. */
  const upcomingSessionSoon = useMemo(() => {
    const now = new Date()
    for (const s of todaySessions) {
      try {
        const start = parseISO(s.scheduled_time)
        if (start <= now) continue
        const mins = differenceInMinutes(start, now)
        if (mins > 0 && mins <= 120) {
          const name =
            [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'your client'
          return { session: s, start, name, minutesUntil: mins }
        }
      } catch {
        /* skip */
      }
    }
    return null
  }, [todaySessions])

  const unreadMessagesTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0),
    [conversations]
  )

  const unreadThreads = useMemo(
    () =>
      conversations.filter((c) => c.hasMessages && c.unreadCount > 0).slice(0, 5),
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
        attention.sessions24h.length +
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

  const dateLine = format(new Date(), 'EEEE, MMMM d, yyyy')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const coachFirst = firstName(coachDisplayName)

  const totalClients = summary?.activeClientsCount ?? 0
  const upcomingCount = upcomingSessionsFiltered.length
  const messagesSentCount = summary?.coachMessagesSentCount ?? 0
  const clientsAddedThisMonth = summary?.clientsAddedThisMonth ?? 0

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

  function personName(first: string | null, last: string | null, fallback = 'Client') {
    const n = [first, last].filter(Boolean).join(' ').trim()
    return n || fallback
  }

  const statAnimateOnce = !loading && summary !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0">
      <div
        style={{
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--warning)',
          display: hasFetchError ? 'flex' : 'none',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span aria-hidden>⚠️</span>
        <span>Some dashboard data could not load.</span>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="ml-auto shrink-0 rounded-[var(--radius-sm)] border border-[var(--warning-border)] bg-[var(--bg-app)] px-3 py-1 text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
        >
          Try again
        </button>
      </div>
      <div
        className="mb-6 shrink-0 rounded-[12px] border border-[var(--border-subtle)] px-6 py-5 lg:mb-[var(--coach-header-content-gap)]"
        style={{
          background: 'linear-gradient(to right, var(--accent-light), transparent)',
        }}
      >
        <div className="flex min-h-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)]">
              {greeting}, {coachFirst} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-[14px] leading-normal text-[var(--text-tertiary)]">
              {loading
                ? 'One moment while we load your workspace…'
                : attentionHasItems
                  ? "Here's what needs your attention today."
                  : 'Everything looks great today! 🎉'}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-quaternary)]">{dateLine}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="secondary" size="md" type="button" onClick={() => router.push('/coach/schedule')}>
              Book session
            </Button>
            <Button variant="primary" size="md" type="button" onClick={() => router.push('/coach/clients')}>
              + Add client
            </Button>
          </div>
        </div>
      </div>

      {!loading ? (
        <Card
          variant="default"
          padding="default"
          className={cn(
            'mb-4 shrink-0 border !p-0',
            attentionHasItems
              ? 'border-l-[3px] border-l-[var(--warning)] border-t-[var(--border-default)] border-r-[var(--border-default)] border-b-[var(--border-default)] bg-[var(--warning-bg)]/35'
              : 'border-[var(--success-border)] bg-[var(--success-bg)]/60'
          )}
        >
          <div className={cn('pl-3', attentionHasItems ? 'border-l-0' : '')}>
            <div className="border-b border-[var(--border-subtle)] px-4 py-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {attentionHasItems ? 'Needs attention' : 'All clear'}
              </h2>
            </div>
            <div className="px-4 py-2">
            {attentionHasItems ? (
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
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5 inline-block w-4 text-center">
                          💬
                        </span>
                        <strong className="font-medium">{name}</strong> — thread quiet for {quietLabel}
                      </span>
                      <div className="flex flex-wrap gap-2">
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
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          className="h-7 min-h-[28px] px-2 text-[12px]"
                          onClick={() =>
                            router.push(
                              `/coach/messages?clientId=${encodeURIComponent(row.clientId)}&checkin=1`
                            )
                          }
                        >
                          Check-in
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
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5">
                          😞
                        </span>
                        <strong className="font-medium">{name}</strong> rated low for {row.consecutiveLowDays} days
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
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5">
                          📋
                        </span>
                        <strong className="font-medium">{name}</strong> — no check-in in {row.daysSinceCheckin} days
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
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5">
                          📋
                        </span>
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
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5">
                          💰
                        </span>
                        <strong className="font-medium">{name}</strong> — invoice unpaid ({daysOld}d)
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
                {attention.sessions24h.map((row) => {
                  const name = personName(row.firstName, row.lastName)
                  const start = parseISO(row.scheduledTime)
                  const h = differenceInHours(start, new Date())
                  const timeLabel = h <= 0 ? 'soon' : `in ${h} hour${h === 1 ? '' : 's'}`
                  return (
                    <li
                      key={`s-${row.id}`}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5">
                          📅
                        </span>
                        Session with <strong className="font-medium">{name}</strong> {timeLabel}
                      </span>
                      <Button variant="ghost" size="xs" type="button" className="h-7 min-h-[28px] px-2 text-[12px]" onClick={() => router.push('/coach/schedule')}>
                        View
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
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 text-[14px] text-[var(--text-primary)]">
                        <span aria-hidden className="mr-1.5">
                          🎯
                        </span>
                        <strong className="font-medium">{name}</strong> is {pct}% through {row.programTitle?.trim() || 'program'}
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
            ) : (
              <div className="py-4 text-center">
                <p className="text-[15px] font-semibold text-[var(--success)]">
                  <span aria-hidden>✅</span> All clients are on track
                </p>
                <p className="mt-1 text-[14px] text-[var(--text-tertiary)]">Nothing needs your attention right now.</p>
              </div>
            )}
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={reEngageBusy}
                onClick={async () => {
                  setReEngageBusy(true)
                  try {
                    const res = await fetch('/api/coach/re-engagement', {
                      method: 'POST',
                      credentials: 'include',
                    })
                    const json = (await res.json().catch(() => ({}))) as {
                      error?: string
                      data?: { coachEmailsSent?: number; autoMessagesSent?: number; testimonialPromptsSent?: number }
                    }
                    if (!res.ok) {
                      setInvoiceToast(json.error ?? 'Re-engagement scan failed')
                      return
                    }
                    const d = json.data
                    setInvoiceToast(
                      `Scan complete: ${d?.coachEmailsSent ?? 0} coach alerts, ${d?.autoMessagesSent ?? 0} auto check-ins, ${d?.testimonialPromptsSent ?? 0} review prompts`
                    )
                    void loadDashboard()
                  } catch {
                    setInvoiceToast('Re-engagement scan failed — try again')
                  } finally {
                    setReEngageBusy(false)
                  }
                }}
              >
                {reEngageBusy ? 'Scanning…' : 'Run re-engagement scan'}
              </Button>
              <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                Checks quiet clients, sends optional auto check-ins, and milestone review requests (see Notifications).
              </p>
            </div>
            </div>
          </div>
        </Card>
      ) : null}

      {showNewCoachOnboarding ? (
        <div
          className="relative mb-6 shrink-0 rounded-[var(--radius-lg)] border border-[var(--accent-muted)] px-6 py-5"
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
                      className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-white"
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

      <div className="mb-6 grid shrink-0 grid-cols-2 gap-4 min-[1280px]:grid-cols-5">
        {loading && !summary ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[132px] w-full rounded-[var(--radius-lg)]" />
            ))}
          </>
        ) : (
          <>
            <StatCardGhost
              animateOnce={statAnimateOnce}
              label="Active clients"
              value={summary?.activeClientsCount ?? 0}
              subtitle={
                clientsAddedThisMonth > 0
                  ? `+${clientsAddedThisMonth} this month`
                  : 'Add clients to get started'
              }
              {...(() => {
                const f = formatTrendLabel(summary?.trends?.activeClients ?? null)
                return f ? { trendLabel: f.label, trendUp: f.up } : {}
              })()}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              }
            />
            <StatCardGhost
              animateOnce={statAnimateOnce}
              label="Sessions this week"
              value={summary?.sessionsThisWeek ?? 0}
              subtitle={
                upcomingToday > 0
                  ? `${upcomingToday} today`
                  : upcomingThisWeek > 0
                    ? `${upcomingThisWeek} upcoming`
                    : 'Schedule your first session'
              }
              {...(() => {
                const f = formatTrendLabel(summary?.trends?.sessionsThisWeek ?? null)
                return f ? { trendLabel: f.label, trendUp: f.up } : {}
              })()}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
            />
            <StatCardGhost
              animateOnce={statAnimateOnce}
              label="Revenue this month"
              value={summary?.revenueMonthCents ?? 0}
              formatter={(n) => formatCents(Math.round(n))}
              {...((summary?.revenueMonthCents ?? 0) <= 0 ? { subtitle: 'Record your first payment' } : {})}
              {...(() => {
                const f = formatTrendLabel(summary?.trends?.revenueMonth ?? null)
                return f ? { trendLabel: f.label, trendUp: f.up } : {}
              })()}
              footer={
                (summary?.revenueMonthCents ?? 0) > 0 && revenueMoMPct !== null ? (
                  <p
                    className={cn(
                      'mt-2 text-[12px] font-medium',
                      revenueMoMPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                    )}
                  >
                    {revenueMoMPct >= 0 ? '↑' : '↓'} {Math.abs(revenueMoMPct)}% vs last month
                  </p>
                ) : null
              }
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" x2="12" y1="1" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <StatCardGhost
              animateOnce={statAnimateOnce}
              label="Unread messages"
              value={unreadMessagesTotal}
              subtitle={unreadMessagesTotal > 0 ? 'Tap to reply' : 'All caught up ✓'}
              {...(unreadMessagesTotal > 0 ? { href: '/coach/messages' } : {})}
              {...(() => {
                const f = formatTrendLabel(summary?.trends?.messagesToCoach ?? null)
                return f ? { trendLabel: f.label, trendUp: f.up } : {}
              })()}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
            />
            <Card
              variant="ghost"
              padding="default"
              className="border border-[var(--border-default)] bg-[var(--bg-app)] p-5 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-tertiary)] [&_svg]:block">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
                  </svg>
                </span>
              </div>
              <p className="mt-3 text-[36px] font-bold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                {storage ? `${storage.usedGb.toFixed(1)} / ${storage.maxGb}` : '—'}
              </p>
              <p className="mt-0.5 text-[13px] font-normal text-[var(--text-tertiary)]">Storage (GB)</p>
              {storage ? (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      storage.pct >= 95
                        ? 'bg-[var(--error)]'
                        : storage.pct >= 80
                          ? 'bg-amber-500'
                          : 'bg-[var(--accent)]'
                    )}
                    style={{ width: `${Math.min(100, storage.pct)}%` }}
                  />
                </div>
              ) : null}
            </Card>
          </>
        )}
      </div>

      <Card variant="default" padding="default" className="mb-4 shrink-0 !p-3">
        <p className="section-label-coach mb-3 md:hidden">Quick actions</p>
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <button
            type="button"
            onClick={() => router.push('/coach/clients')}
            className="flex h-16 min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-tertiary)] transition-all duration-[150ms] ease-out active:border-[var(--accent-muted)] active:bg-[var(--accent-light)] active:text-[var(--accent)]"
          >
            <Users className="size-5 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <span>Add client</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/coach/schedule')}
            className="flex h-16 min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-tertiary)] transition-all duration-[150ms] ease-out active:border-[var(--accent-muted)] active:bg-[var(--accent-light)] active:text-[var(--accent)]"
          >
            <Calendar className="size-5 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <span>Book session</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickInvoiceOpen(true)}
            className="flex h-16 min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-tertiary)] transition-all duration-[150ms] ease-out active:border-[var(--accent-muted)] active:bg-[var(--accent-light)] active:text-[var(--accent)]"
          >
            <CreditCard className="size-5 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <span>Quick invoice</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/coach/messages')}
            className="flex h-16 min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[12px] font-medium text-[var(--text-tertiary)] transition-all duration-[150ms] ease-out active:border-[var(--accent-muted)] active:bg-[var(--accent-light)] active:text-[var(--accent)]"
          >
            <MessageSquare className="size-5 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
            <span>Messages</span>
          </button>
        </div>
        <p className="section-label-coach mb-3 hidden md:block">Quick actions</p>
        <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
          <QuickAction label="Add client" onClick={() => router.push('/coach/clients')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} />
          <QuickAction label="Book session" onClick={() => router.push('/coach/schedule')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
          <QuickAction label="Quick invoice" onClick={() => setQuickInvoiceOpen(true)} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>} />
          <QuickAction label="All invoices" onClick={() => router.push('/coach/invoices')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>} />
          <QuickAction label="Record payment" onClick={() => router.push('/coach/payments')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2" /></svg>} />
          <QuickAction label="Create program" onClick={() => router.push('/coach/programs')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></svg>} />
          <QuickAction label="Open messages" onClick={() => router.push('/coach/messages')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>} />
        </div>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
        <Card variant="default" padding="default" className="flex min-h-0 flex-col overflow-hidden !p-0">
          <PanelHeader
            title="Today's sessions"
            action={
              <Link href="/coach/schedule" className="text-[12px] font-medium text-[var(--accent)] hover:underline">
                View all
              </Link>
            }
          />
          <div className="panel-body-scroll max-h-[280px] min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {loading ? (
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="skeleton h-14 rounded-[var(--radius-md)]" />
                ))}
              </ul>
            ) : todaySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  📅 Your calendar is clear today
                </p>
                <p className="mt-2 max-w-[280px] text-[14px] leading-[1.6] text-[var(--text-tertiary)]">
                  Book a session or set availability so clients can grab time with you.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="primary" size="sm" type="button" onClick={() => router.push('/coach/schedule')}>
                    Book session
                  </Button>
                  <Button variant="secondary" size="sm" type="button" onClick={() => router.push('/coach/schedule')}>
                    Set availability
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {upcomingSessionSoon ? (
                  <li className="mb-4">
                    <Link
                      href={`/coach/schedule?session=${upcomingSessionSoon.session.id}`}
                      className="block rounded-[var(--radius-lg)] border-2 border-[var(--accent)] bg-[var(--accent-light)] px-4 py-3 shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--accent-muted)]/40"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
                        Starting soon
                      </p>
                      <p className="mt-1 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
                        Your next session with {upcomingSessionSoon.name} starts{' '}
                        {formatDistanceToNow(upcomingSessionSoon.start, { addSuffix: true })}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                        {format(upcomingSessionSoon.start, 'h:mm a')} · {upcomingSessionSoon.session.status}
                      </p>
                    </Link>
                  </li>
                ) : null}
                {todaySessions.map((s) => {
                  if (upcomingSessionSoon && s.id === upcomingSessionSoon.session.id) return null
                  const name =
                    [s.clients?.first_name, s.clients?.last_name].filter(Boolean).join(' ') || 'Client'
                  const start = parseISO(s.scheduled_time)
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/coach/schedule?session=${s.id}`}
                        className="clickable-row flex h-14 items-center gap-3 rounded-[var(--radius-md)] px-2"
                      >
                        <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-light)] text-[11px] font-semibold text-[var(--accent)]">
                          {initials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{name}</p>
                          <p className="text-[12px] text-[var(--text-tertiary)]">{format(start, 'h:mm a')}</p>
                        </div>
                        <Badge variant="accent" className="shrink-0">
                          {s.status}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--border-subtle)] px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => router.push('/coach/schedule')}
              >
                Book session
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => setPaymentModalOpen(true)}>
                Record payment
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="default" className="flex min-h-0 flex-col overflow-hidden !p-0">
          <PanelHeader
            title="Messages"
            action={
              <Link href="/coach/messages" className="text-[12px] font-medium text-[var(--accent)] hover:underline">
                View all
              </Link>
            }
          />
          <div className="panel-body-scroll max-h-[280px] min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {loading ? (
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="skeleton h-14 rounded-[var(--radius-md)]" />
                ))}
              </ul>
            ) : unreadThreads.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">You&apos;re all caught up</p>
            ) : (
              <ul className="space-y-3">
                {unreadThreads.map((c) => (
                  <li key={c.clientId}>
                    <Link
                      href={`/coach/messages?clientId=${encodeURIComponent(c.clientId)}`}
                      className="clickable-row flex h-14 items-center gap-3 rounded-[var(--radius-md)] px-2"
                    >
                      <div className="relative shrink-0">
                        <div className="flex size-6 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-semibold text-[var(--accent)]">
                          {initials(c.fullName)}
                        </div>
                        <span
                          className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-app)]"
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                            {c.fullName}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--text-quaternary)]">
                            {c.lastMessageAt
                              ? formatDistanceToNow(parseISO(c.lastMessageAt), { addSuffix: true })
                              : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--text-tertiary)]">
                          {c.lastMessagePreview}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--border-subtle)] px-5 py-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="w-full sm:w-auto"
              onClick={() => router.push('/coach/messages')}
            >
              View all messages
            </Button>
          </div>
        </Card>

        <Card variant="default" padding="default" className="flex min-h-0 flex-col overflow-hidden !p-0">
          <PanelHeader
            title="Activity"
            action={
              <Link href="/coach/programs" className="text-[12px] font-medium text-[var(--accent)] hover:underline">
                View all
              </Link>
            }
          />
          <div className="panel-body-scroll max-h-[280px] min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {loading ? (
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="skeleton h-14 rounded-[var(--radius-md)]" />
                ))}
              </ul>
            ) : activityPreview.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">No recent activity</p>
            ) : (
              <ul className="space-y-3">
                {activityPreview.map((row) => (
                  <li key={row.id} className="flex h-[52px] gap-3 rounded-[var(--radius-md)] px-1 py-1">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)]">
                      {activityIcon(row.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] leading-snug text-[var(--text-primary)]">
                        {row.summary}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-quaternary)]">
                        {formatDistanceToNow(parseISO(row.at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--border-subtle)] px-5 py-3">
            <p className="text-center text-[11px] text-[var(--text-quaternary)]">
              Last updated {format(new Date(), 'MMM d, h:mm a')}
            </p>
          </div>
        </Card>
      </div>

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
