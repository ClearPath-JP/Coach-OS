'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow, isSameDay, parseISO } from 'date-fns'
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
  pendingInvoicesCount: number
  trends?: {
    activeClients: Trend
    sessionsThisWeek: Trend
    revenueMonth: Trend
    messagesToCoach: Trend
  }
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

function greetingLabel(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
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
}: {
  label: string
  value: number
  icon: React.ReactNode
  trendUp?: boolean
  trendLabel?: string
  formatter?: (value: number) => string
}) {
  return (
    <Card variant="ghost" padding="default" className="p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[var(--accent)] [&_svg]:block">{icon}</span>
        {trendLabel ? (
          <span
            className={cn(
              'rounded-[var(--radius-full)] px-2 py-0.5 text-[11px] font-medium',
              trendUp === true && 'bg-[var(--success-bg)] text-[var(--success)]',
              trendUp === false && 'bg-[var(--error-bg)] text-[var(--error)]',
              trendUp === undefined && 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
            )}
          >
            {trendLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[32px] font-bold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
        {formatter ? <CountUpValue value={value} formatter={formatter} /> : <CountUpValue value={value} />}
      </p>
      <p className="mt-1 text-[12px] font-normal text-[var(--text-tertiary)]">{label}</p>
    </Card>
  )
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">{title}</h2>
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
        'group flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-transparent',
        'bg-[var(--accent-light)] px-3 py-3 text-center text-[12px] font-medium text-[var(--text-primary)]',
        'transition-all duration-[var(--duration-fast)]',
        'hover:-translate-y-px hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)]'
      )}
    >
      <span className="text-[var(--accent)] transition-colors group-hover:text-[var(--text-on-accent)] [&_svg]:size-6">
        {icon}
      </span>
      <span>{label}</span>
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
  const [loading, setLoading] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const [sumRes, sessRes, convRes, actRes, storRes] = await Promise.all([
          fetch('/api/coach/dashboard-summary'),
          fetch('/api/coach/sessions'),
          fetch('/api/messages/conversations'),
          fetch('/api/coach/program-activity'),
          fetch('/api/coach/storage'),
        ])
        const sumJson = await sumRes.json().catch(() => ({}))
        const sessJson = await sessRes.json().catch(() => ({}))
        const convJson = await convRes.json().catch(() => ({}))
        const actJson = await actRes.json().catch(() => ({}))
        const storJson = await storRes.json().catch(() => ({}))
        if (cancelled) return
        if (sumJson.data) setSummary(sumJson.data)
        if (Array.isArray(sessJson.data)) setSessions(sessJson.data)
        if (Array.isArray(convJson.data)) setConversations(convJson.data)
        if (Array.isArray(actJson.data)) setActivity(actJson.data)
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
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const todaySessions = useMemo(() => {
    const today = new Date()
    return sessions.filter((s) => {
      try {
        return isSameDay(parseISO(s.scheduled_time), today)
      } catch {
        return false
      }
    })
  }, [sessions])

  const unreadMessagesTotal = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0),
    [conversations]
  )

  const unreadThreads = useMemo(
    () =>
      conversations.filter((c) => c.hasMessages && c.unreadCount > 0).slice(0, 5),
    [conversations]
  )

  const activityPreview = useMemo(() => activity.slice(0, 5), [activity])

  const dateLine = format(new Date(), 'EEEE, MMMM d')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-8 pr-8 pb-6 pl-8 lg:min-h-0">
      <div className="mb-7 grid min-h-0 shrink-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {greetingLabel()}, {firstName(coachDisplayName)}{' '}
            <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">{dateLine}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => router.push('/coach/clients')}
          >
            Add client
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            onClick={() => router.push('/coach/schedule')}
          >
            Book session
          </Button>
        </div>
      </div>

      <div className="mb-6 grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-5">
        {loading && !summary ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[118px] w-full rounded-[var(--radius-lg)]" />
            ))}
          </>
        ) : (
          <>
            <StatCardGhost
              label="Active clients"
              value={summary?.activeClientsCount ?? 0}
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
              label="Sessions this week"
              value={summary?.sessionsThisWeek ?? 0}
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
              label="Revenue this month"
              value={summary?.revenueMonthCents ?? 0}
              formatter={(n) => formatCents(Math.round(n))}
              {...(() => {
                const f = formatTrendLabel(summary?.trends?.revenueMonth ?? null)
                return f ? { trendLabel: f.label, trendUp: f.up } : {}
              })()}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" x2="12" y1="1" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <StatCardGhost
              label="Unread messages"
              value={unreadMessagesTotal}
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
            <Card variant="ghost" padding="default" className="p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[var(--accent)] [&_svg]:block">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
                  </svg>
                </span>
              </div>
              <p className="mt-3 text-[20px] font-bold leading-none tracking-[-0.03em] text-[var(--text-primary)] tabular-nums">
                {storage ? `${storage.usedGb.toFixed(1)} / ${storage.maxGb}` : '—'}
              </p>
              <p className="mt-1 text-[12px] font-normal text-[var(--text-tertiary)]">Storage (GB)</p>
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
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)] md:hidden">Quick actions</p>
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <QuickAction
            label="Add client"
            onClick={() => router.push('/coach/clients')}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
            }
          />
          <QuickAction
            label="Book session"
            onClick={() => router.push('/coach/schedule')}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
          />
          <QuickAction
            label="Record payment"
            onClick={() => router.push('/coach/payments')}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
              </svg>
            }
          />
          <QuickAction
            label="Messages"
            onClick={() => router.push('/coach/messages')}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
        </div>
        <div className="hidden grid-cols-3 gap-2 md:grid xl:grid-cols-6">
          <QuickAction label="Add client" onClick={() => router.push('/coach/clients')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} />
          <QuickAction label="Book session" onClick={() => router.push('/coach/schedule')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>} />
          <QuickAction label="Send invoice" onClick={() => router.push('/coach/invoices')} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>} />
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
              <Link href="/coach/schedule" className="link-nav text-[12px] font-medium">
                Calendar
              </Link>
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {loading ? (
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-muted)]" />
                ))}
              </ul>
            ) : todaySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">No sessions today</p>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="mt-4"
                  onClick={() => router.push('/coach/schedule')}
                >
                  Book session
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {todaySessions.map((s) => {
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
          <PanelHeader title="Messages" />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {loading ? (
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-muted)]" />
                ))}
              </ul>
            ) : unreadThreads.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">You&apos;re all caught up</p>
            ) : (
              <ul className="space-y-3">
                {unreadThreads.map((c) => (
                  <li key={c.clientId}>
                    <Link
                      href={`/coach/messages?client=${c.clientId}`}
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
              <Link href="/coach/programs" className="link-nav text-[12px] font-medium">
                Programs
              </Link>
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {loading ? (
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-muted)]" />
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
          void fetch('/api/coach/dashboard-summary')
            .then((r) => r.json())
            .then((json) => {
              if (json.data) setSummary(json.data)
            })
        }}
      />
    </div>
  )
}
