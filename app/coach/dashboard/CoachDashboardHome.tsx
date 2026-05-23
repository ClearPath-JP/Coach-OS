'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  CreditCard,
  ClipboardCheck,
  Package,
  Swords,
  Ticket,
  Users,
  Video,
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
}: {
  label: string
  value: string
  trend?: { direction: string; percentChange: number }
}) {
  return (
    <div className="group flex flex-col gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-5 py-4 transition-all duration-200 hover:border-[var(--border-default)] hover:bg-[var(--bg-muted)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">{label}</span>
      <div className="flex items-end gap-2">
        <span className="font-display text-[28px] font-medium leading-none tracking-tight text-[var(--text-primary)]">{value}</span>
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

const NAV_TILES = [
  { href: '/coach/schedule', label: 'Schedule', desc: 'Sessions & availability', icon: CalendarDays },
  { href: '/coach/classes', label: 'Classes', desc: 'Bookable group classes', icon: Ticket },
  { href: '/coach/clients', label: 'Clients', desc: 'Manage your roster', icon: Users },
  { href: '/coach/assignments', label: 'Assignments', desc: 'Homework & reviews', icon: ClipboardCheck },
  { href: '/coach/programs', label: 'Programs', desc: 'Training programs', icon: Swords },
  { href: '/coach/packages', label: 'Packages', desc: 'Session packages', icon: Package },
  { href: '/coach/payments', label: 'Payments', desc: 'Revenue & invoices', icon: CreditCard },
  { href: '/coach/videos', label: 'Videos', desc: 'Video library', icon: Video },
] as const

function AttentionBanner({ attention, badges }: { attention: AttentionData | null; badges: Badges }) {
  const items: { label: string; href: string; count: number }[] = []
  if (badges.assignments > 0) items.push({ label: 'assignments need review', href: '/coach/assignments', count: badges.assignments })
  if (attention?.overdue?.length) items.push({ label: 'overdue assignments', href: '/coach/assignments', count: attention.overdue.length })
  if (attention?.inactive?.length) items.push({ label: 'clients need engagement', href: '/coach/clients', count: attention.inactive.length })
  if (attention?.unpaidInvoices?.length) items.push({ label: 'unpaid invoices', href: '/coach/payments', count: attention.unpaidInvoices.length })

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-surface)] px-5 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--accent)]">
        <AlertTriangle size={15} />
        <span>Needs attention</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {items.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="text-[13px] text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-2 transition-colors hover:text-[var(--text-primary)]"
          >
            {item.count} {item.label}
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
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Get started</h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
            {completed} of {steps.length} complete
          </p>
        </div>
        <div className="flex h-2 w-24 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <Link
            key={step.href + step.label}
            href={step.href}
            className={cn(
              'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150',
              step.done
                ? 'opacity-50'
                : 'hover:bg-[var(--bg-muted)]',
            )}
          >
            {step.done ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            ) : (
              <Circle size={16} className="mt-0.5 shrink-0 text-[var(--text-quaternary)] group-hover:text-[var(--text-tertiary)]" />
            )}
            <div className="min-w-0">
              <span className={cn(
                'text-[13px] font-medium',
                step.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]',
              )}>
                {step.label}
              </span>
              <p className="text-[12px] text-[var(--text-quaternary)]">{step.desc}</p>
            </div>
            {!step.done && (
              <ArrowRight size={14} className="ml-auto mt-0.5 shrink-0 text-[var(--text-quaternary)] opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function CoachDashboardHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attention, setAttention] = useState<AttentionData | null>(null)
  const [badges, setBadges] = useState<Badges>({ assignments: 0, programsCount: 0 })
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      fetch('/api/coach/dashboard-summary', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/coach/dashboard-attention', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/assignments/overview', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/programs', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
    ]).then(([statsJson, attentionJson, asgJson, programsJson]) => {
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
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const s = stats ?? ZERO_STATS

  return (
    <div className="coach-dash-stagger flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-[28px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">
          Command Center
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--text-tertiary)]">
          Your dojo at a glance.
        </p>
      </div>

      {/* Attention banner */}
      {!loading && <AttentionBanner attention={attention} badges={badges} />}

      {/* Stats row — always visible */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active Clients" value={String(s.activeClientsCount)} trend={s.trends?.activeClients} />
          <StatCard label="Sessions This Week" value={String(s.sessionsThisWeek)} trend={s.trends?.sessionsThisWeek} />
          <StatCard label="Revenue (Month)" value={formatCents(s.revenueMonthCents)} trend={s.trends?.revenueMonth} />
          <StatCard label="Pending Invoices" value={String(s.pendingInvoicesCount)} />
        </div>
      )}

      {/* Getting started — shown until core actions are done */}
      {!loading && <GettingStarted stats={s} programsCount={badges.programsCount} />}

      {/* Quick nav tiles */}
      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {NAV_TILES.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-5 py-4',
                'transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:bg-[var(--bg-muted)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.18)]',
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--bg-muted)] transition-colors group-hover:bg-[var(--accent)]/10">
                <Icon size={18} strokeWidth={1.5} className="text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent)]" />
              </div>
              <div>
                <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
                <p className="mt-0.5 text-[12px] text-[var(--text-quaternary)]">{desc}</p>
              </div>
              <ArrowRight size={14} className="absolute right-4 top-4 text-[var(--text-quaternary)] opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
