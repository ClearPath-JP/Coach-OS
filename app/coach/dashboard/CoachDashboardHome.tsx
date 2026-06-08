'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { cn } from '@/lib/utils'
import {
  todayRows,
  nextSession,
  messageRows,
  unreadTotal,
  type SessionRow,
  type ConversationRow,
} from './dashboard-data'
import { GreetingBar, TodayPanel, MessagesPeek, QuickActions } from './dashboard-widgets'

type DashboardStats = {
  activeClientsCount: number
  sessionsThisWeek: number
  revenueMonthCents: number
  revenuePrevMonthCents: number
  pendingInvoicesCount: number
  trends: {
    sessionsThisWeek: { direction: string; percentChange: number }
    revenueMonth: { direction: string; percentChange: number }
    activeClients: { direction: string; percentChange: number }
  }
}

type AttentionData = {
  inactive: Array<{ clientId: string; firstName: string | null; lastName: string | null }>
  overdue: Array<{ id: string; clientId: string; templateTitle: string | null; firstName: string | null; lastName: string | null }>
  unpaidInvoices: Array<{ id: string; amountCents: number; firstName: string | null; lastName: string | null }>
}

type Badges = { assignments: number; programsCount: number }

const ZERO_STATS: DashboardStats = {
  activeClientsCount: 0,
  sessionsThisWeek: 0,
  revenueMonthCents: 0,
  revenuePrevMonthCents: 0,
  pendingInvoicesCount: 0,
  trends: {
    sessionsThisWeek: { direction: 'flat', percentChange: 0 },
    revenueMonth: { direction: 'flat', percentChange: 0 },
    activeClients: { direction: 'flat', percentChange: 0 },
  },
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'up') return <TrendingUp size={14} className="text-emerald-400" />
  if (direction === 'down') return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-[var(--text-quaternary)]" />
}

function StatCard({
  label,
  value,
  trend,
  accent = false,
  zero = false,
}: {
  label: string
  value: string
  trend?: { direction: string; percentChange: number }
  accent?: boolean
  zero?: boolean
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-2xl border bg-[var(--bg-subtle)] px-5 py-4 transition-all duration-200 hover:bg-[var(--bg-muted)]',
        accent
          ? 'border-[var(--border-subtle)] before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:rounded-r-full before:bg-[var(--accent)] before:shadow-[0_0_12px_var(--accent)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
      )}
    >
      <span className="text-[11px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">{label}</span>
      <div className="flex items-end gap-2">
        <span
          className={cn(
            'font-display text-[28px] font-medium leading-none tracking-tight',
            zero ? 'text-[var(--text-quaternary)]' : 'text-[var(--text-primary)]',
          )}
        >
          {value}
        </span>
        {trend && trend.percentChange > 0 ? (
          <span className="mb-0.5 flex items-center gap-1 text-[12px]">
            <TrendIcon direction={trend.direction} />
            <span className={trend.direction === 'up' ? 'text-emerald-400' : trend.direction === 'down' ? 'text-red-400' : 'text-[var(--text-quaternary)]'}>
              {Math.round(trend.percentChange)}%
            </span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function AttentionStrip({ attention, pendingInvoicesCount }: { attention: AttentionData | null; pendingInvoicesCount: number }) {
  const items: { label: string; href: string }[] = []
  if (attention?.inactive?.length) {
    items.push({
      label: `${attention.inactive.length} ${attention.inactive.length === 1 ? 'client needs' : 'clients need'} engagement`,
      href: '/coach/clients',
    })
  }
  if (pendingInvoicesCount > 0) {
    const total = attention?.unpaidInvoices?.reduce((a, i) => a + (i.amountCents || 0), 0) ?? 0
    const amt = total > 0 ? ` · ${formatCents(total)}` : ''
    items.push({
      label: `${pendingInvoicesCount} unpaid ${pendingInvoicesCount === 1 ? 'invoice' : 'invoices'}${amt}`,
      href: '/coach/invoices',
    })
  }
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-surface)] px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--accent)]">
        <AlertTriangle size={15} />
        <span>Needs attention</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[13px] text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-2 transition-colors hover:text-[var(--text-primary)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function GettingStarted({ stats, programsCount }: { stats: DashboardStats; programsCount: number }) {
  const steps = [
    { done: stats.activeClientsCount > 0, label: 'Add your first client', href: '/coach/clients', desc: 'Import or create a client profile' },
    { done: stats.sessionsThisWeek > 0, label: 'Book a session', href: '/coach/schedule', desc: 'Schedule your first training session' },
    { done: programsCount > 0, label: 'Create a program', href: '/coach/programs', desc: 'Build a structured training program' },
    { done: stats.revenueMonthCents > 0, label: 'Record a payment', href: '/coach/payments', desc: 'Track revenue from your clients' },
  ]
  const completed = steps.filter((s) => s.done).length
  if (completed >= steps.length) return null
  return (
    <div className="gloss-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Get started</h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">{completed} of {steps.length} complete</p>
        </div>
        <div className="flex h-2 w-24 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <Link
            key={step.href + step.label}
            href={step.href}
            className={cn('group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150', step.done ? 'opacity-50' : 'hover:bg-[var(--bg-muted)]')}
          >
            {step.done ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            ) : (
              <Circle size={16} className="mt-0.5 shrink-0 text-[var(--text-quaternary)] group-hover:text-[var(--text-tertiary)]" />
            )}
            <div className="min-w-0">
              <span className={cn('text-[13px] font-medium', step.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]')}>{step.label}</span>
              <p className="text-[12px] text-[var(--text-quaternary)]">{step.desc}</p>
            </div>
            {!step.done && <ArrowRight size={14} className="ml-auto mt-0.5 shrink-0 text-[var(--text-quaternary)] opacity-0 transition-opacity group-hover:opacity-100" />}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function CoachDashboardHome({ coachName }: { coachName: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attention, setAttention] = useState<AttentionData | null>(null)
  const [badges, setBadges] = useState<Badges>({ assignments: 0, programsCount: 0 })
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(false)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const opts = { credentials: 'include' as const, signal: controller.signal }
    const now = new Date()
    const weekQ = `?from=${encodeURIComponent(startOfWeek(now, { weekStartsOn: 1 }).toISOString())}&to=${encodeURIComponent(endOfWeek(now, { weekStartsOn: 1 }).toISOString())}`
    try {
      const [statsJson, attentionJson, asgJson, programsJson, sessJson, convJson] = await Promise.all([
        fetch('/api/coach/dashboard-summary', opts).then((r) => r.json()),
        fetch('/api/coach/dashboard-attention', opts).then((r) => r.json()).catch(() => null),
        fetch('/api/assignments/overview', opts).then((r) => r.json()).catch(() => null),
        fetch('/api/programs', opts).then((r) => r.json()).catch(() => null),
        fetch(`/api/coach/sessions${weekQ}`, opts).then((r) => r.json()).catch(() => null),
        fetch('/api/messages/conversations', opts).then((r) => r.json()).catch(() => null),
      ])
      setStats(statsJson?.data ?? ZERO_STATS)
      if (attentionJson?.data) setAttention(attentionJson.data)
      let asg = 0
      if (asgJson?.data) {
        const pr = typeof asgJson.data.pendingReviewCount === 'number' ? asgJson.data.pendingReviewCount : 0
        const ov = typeof asgJson.data.overdueCount === 'number' ? asgJson.data.overdueCount : 0
        asg = pr + ov
      }
      const pgCount = Array.isArray(programsJson?.data) ? programsJson.data.length : 0
      setBadges({ assignments: asg, programsCount: pgCount })
      setSessions(Array.isArray(sessJson?.data) ? sessJson.data : [])
      setConversations(Array.isArray(convJson?.data) ? convJson.data : [])
    } catch {
      setError(true)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const s = stats ?? ZERO_STATS
  const today = useMemo(() => todayRows(sessions, new Date()), [sessions])
  const nextUp = useMemo(() => nextSession(sessions, new Date()), [sessions])
  const msgs = useMemo(() => messageRows(conversations, 3), [conversations])
  const unread = useMemo(() => unreadTotal(conversations), [conversations])

  const coachFirst = coachName.trim().split(/\s+/)[0] || 'Coach'
  // Time-based greeting + date are computed AFTER mount (client-only). Computing them during
  // render makes the SSR output (server timezone) differ from the client's local timezone,
  // which causes a hydration text mismatch (React #418). Empty until mounted, then filled in.
  const [greeting, setGreeting] = useState('')
  const [dateLine, setDateLine] = useState('')
  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    setDateLine(format(now, 'EEEE · MMMM d'))
  }, [])

  return (
    <div className="coach-dash-stagger flex flex-col gap-6">
      <GreetingBar coachFirst={coachFirst} dateLine={dateLine} greeting={greeting} next={nextUp} />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-8 text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Couldn’t load your dashboard</p>
          <p className="mt-1 text-xs text-[var(--text-quaternary)]">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => void fetchAll()}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active clients" value={String(s.activeClientsCount)} trend={s.trends?.activeClients} zero={s.activeClientsCount === 0} />
          <StatCard label="Sessions this week" value={String(s.sessionsThisWeek)} trend={s.trends?.sessionsThisWeek} zero={s.sessionsThisWeek === 0} />
          <StatCard label="Revenue (month)" value={formatCents(s.revenueMonthCents)} trend={s.trends?.revenueMonth} zero={s.revenueMonthCents === 0} />
          <StatCard label="Pending invoices" value={String(s.pendingInvoicesCount)} accent={s.pendingInvoicesCount > 0} zero={s.pendingInvoicesCount === 0} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          <TodayPanel items={today} />
          {!loading && !error && <GettingStarted stats={s} programsCount={badges.programsCount} />}
        </div>
        <div className="flex flex-col gap-4">
          {!loading && !error && <AttentionStrip attention={attention} pendingInvoicesCount={s.pendingInvoicesCount} />}
          <MessagesPeek items={msgs} unreadTotal={unread} />
          <QuickActions />
        </div>
      </div>
    </div>
  )
}
