'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import { TrendingUp, TrendingDown, AlertTriangle, ArrowRight } from 'lucide-react'
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
import { WelcomeGuide } from './WelcomeGuide'

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

type TileColor = 'yellow' | 'teal' | 'violet' | 'coral' | 'blue'

const TILE_CLASS: Record<TileColor, string> = {
  yellow: 'tile-yellow',
  teal: 'tile-teal',
  violet: 'tile-violet',
  coral: 'tile-coral',
  blue: 'tile-blue',
}
// On dark belt tiles (teal/coral/blue) text rides white; on light tiles (yellow/violet) text is ink.
const TILE_DARK: Record<TileColor, boolean> = { yellow: false, teal: true, violet: false, coral: true, blue: true }

function StatTile({
  label,
  value,
  color,
  trend,
  note,
}: {
  label: string
  value: string
  color: TileColor
  trend?: { direction: string; percentChange: number }
  note?: string
}) {
  const dark = TILE_DARK[color]
  const muted = dark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)'
  const eyebrow = dark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)'
  const showTrend = trend && trend.percentChange > 0
  return (
    <div className={cn(TILE_CLASS[color], 'p-5')}>
      <div
        className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: eyebrow }}
      >
        {label}
      </div>
      <div className="font-[family-name:var(--font-display)] text-[34px] font-extrabold leading-none tracking-[-0.03em]">
        {value}
      </div>
      <div
        className="mt-2 flex items-center gap-1 font-[family-name:var(--font-display)] text-[12px] font-bold"
        style={{ color: muted }}
      >
        {showTrend ? (
          <>
            {trend!.direction === 'up' ? (
              <TrendingUp size={13} strokeWidth={2.5} />
            ) : trend!.direction === 'down' ? (
              <TrendingDown size={13} strokeWidth={2.5} />
            ) : null}
            {Math.round(trend!.percentChange)}% vs last
          </>
        ) : (
          (note ?? ' ')
        )}
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
    <div className="tile-coral p-4">
      <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[13px] font-extrabold text-white">
        <AlertTriangle size={15} strokeWidth={2.5} />
        <span>Needs attention</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--border-default)] bg-white/90 px-3 py-2 font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-primary)] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-xs)]"
          >
            <span>{item.label}</span>
            <ArrowRight size={14} strokeWidth={2.5} className="shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Recent activity, honestly derived from the data already loaded (no invented feed). */
function ActivityCard({
  attention,
  badges,
  programsCompleteOf,
}: {
  attention: AttentionData | null
  badges: Badges
  programsCompleteOf: { done: number; total: number }
}) {
  const rows: { medal: string; tile: string; title: string; sub: string; href: string }[] = []

  attention?.unpaidInvoices?.slice(0, 2).forEach((inv) => {
    const name = [inv.firstName, inv.lastName].filter(Boolean).join(' ').trim() || 'A client'
    rows.push({
      medal: '💸',
      tile: 'var(--belt-coral)',
      title: 'Invoice awaiting payment',
      sub: `${formatCents(inv.amountCents || 0)} · ${name}`,
      href: '/coach/invoices',
    })
  })
  if (badges.assignments > 0) {
    rows.push({
      medal: '📋',
      tile: 'var(--belt-blue)',
      title: `${badges.assignments} assignment${badges.assignments === 1 ? '' : 's'} to review`,
      sub: 'Pending review or overdue',
      href: '/coach/assignments',
    })
  }
  attention?.inactive?.slice(0, 2).forEach((c) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || 'A client'
    rows.push({
      medal: '👋',
      tile: 'var(--belt-yellow)',
      title: 'Hasn’t trained lately',
      sub: `Reach out to ${name}`,
      href: `/coach/clients/${c.clientId}`,
    })
  })

  const goalPct = programsCompleteOf.total > 0
    ? Math.round((programsCompleteOf.done / programsCompleteOf.total) * 100)
    : 0
  const goalComplete = programsCompleteOf.done >= programsCompleteOf.total

  return (
    <section className="card-gloss rounded-[16px] p-5">
      <div className="mb-4">
        <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Recent
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
          Activity
        </h2>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border-[3px] border-dashed border-[var(--border-default)] px-4 py-5 text-center font-[family-name:var(--font-display)] text-[13px] font-medium text-[var(--text-tertiary)]">
          Nothing needs you right now. 🥋
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.slice(0, 4).map((r, i) => (
            <Link key={r.href + i} href={r.href} className="flex items-start gap-3 group">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--border-default)] text-[18px]"
                style={{ background: r.tile, boxShadow: '3px 3px 0 var(--border-default)' }}
              >
                {r.medal}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="truncate font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-primary)] group-hover:underline">
                  {r.title}
                </div>
                <div className="truncate font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-secondary)]">
                  {r.sub}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Setup goal — real completion of the get-started steps (honest denominator). */}
      {!goalComplete ? (
        <div className="mt-5 border-t-[3px] border-[var(--border-default)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-primary)]">
              🎯 Dojo setup
            </span>
            <span className="font-[family-name:var(--font-display)] text-[12px] font-extrabold text-[var(--text-secondary)]">
              {programsCompleteOf.done} / {programsCompleteOf.total}
            </span>
          </div>
          <div className="arcade-track">
            <div className="arcade-fill arcade-fill-yellow" style={{ width: `${goalPct}%` }} />
          </div>
          <div className="mt-1.5 font-[family-name:var(--font-display)] text-[11px] font-semibold text-[var(--text-tertiary)]">
            {goalPct}% set up · {programsCompleteOf.total - programsCompleteOf.done} to go 🏆
          </div>
        </div>
      ) : (
        <div className="mt-5 border-t-[3px] border-[var(--border-default)] pt-4 font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-primary)]">
          🏆 Dojo fully set up — nice work.
        </div>
      )}
    </section>
  )
}

function GettingStarted({ steps }: { steps: { done: boolean; label: string; href: string; desc: string }[] }) {
  const completed = steps.filter((s) => s.done).length
  if (completed >= steps.length) return null
  return (
    <section className="card-gloss rounded-[16px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            First steps
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
            Get set up
          </h2>
        </div>
        <span className="arcade-badge arcade-badge-yellow">{completed}/{steps.length}</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {steps.map((step) => (
          <Link
            key={step.href + step.label}
            href={step.href}
            className={cn(
              'flex items-start gap-3 rounded-[12px] border-[3px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-3 transition-transform',
              step.done
                ? 'opacity-55'
                : 'shadow-[var(--shadow-sm)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-md)]',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border-default)] font-[family-name:var(--font-display)] text-[11px] font-extrabold',
                step.done ? 'bg-[var(--belt-green)] text-[var(--border-default)]' : 'bg-[var(--bg-muted)] text-transparent',
              )}
            >
              ✓
            </span>
            <div className="min-w-0">
              <span
                className={cn(
                  'font-[family-name:var(--font-display)] text-[13px] font-bold',
                  step.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]',
                )}
              >
                {step.label}
              </span>
              <p className="font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-tertiary)]">{step.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** A warm monthly ROI moment for the coach (the retention loop) — built from data already
 *  loaded. Rendered only once the coach has students, so a brand-new coach never sees a $0. */
function MonthlyCard({
  revenueCents,
  trend,
  activeClients,
}: {
  revenueCents: number
  trend?: { direction: string; percentChange: number }
  activeClients: number
}) {
  const showTrend = trend && trend.percentChange > 0
  return (
    <section className="card-gloss rounded-[16px] p-5">
      <div className="mb-3">
        <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          This month
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
          Your dojo this month
        </h2>
      </div>
      <div className="font-[family-name:var(--font-display)] text-[32px] font-extrabold leading-none tracking-[-0.03em] text-[var(--text-primary)]">
        {formatCents(revenueCents)}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-secondary)]">
        {showTrend ? (
          <>
            {trend!.direction === 'up' ? (
              <TrendingUp size={13} strokeWidth={2.5} />
            ) : trend!.direction === 'down' ? (
              <TrendingDown size={13} strokeWidth={2.5} />
            ) : null}
            {Math.round(trend!.percentChange)}% vs last month
          </>
        ) : (
          <span>collected so far</span>
        )}
      </div>
      <div className="mt-3 border-t-[3px] border-[var(--border-default)] pt-3 font-[family-name:var(--font-display)] text-[12px] font-semibold text-[var(--text-tertiary)]">
        {activeClients} {activeClients === 1 ? 'student' : 'students'} training with you 🥋
      </div>
    </section>
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

  // Real "get started" steps (also feed the Activity card's setup goal denominator).
  const steps = useMemo(
    () => [
      { done: s.activeClientsCount > 0, label: 'Add your first client', href: '/coach/clients', desc: 'Import or create a profile' },
      { done: s.sessionsThisWeek > 0, label: 'Book a session', href: '/coach/schedule', desc: 'Schedule your first session' },
      { done: badges.programsCount > 0, label: 'Create a program', href: '/coach/programs', desc: 'Build a training program' },
      { done: s.revenueMonthCents > 0, label: 'Record a payment', href: '/coach/payments', desc: 'Track revenue from clients' },
    ],
    [s.activeClientsCount, s.sessionsThisWeek, s.revenueMonthCents, badges.programsCount],
  )
  const stepsDone = steps.filter((st) => st.done).length

  const coachFirst = coachName.trim().split(/\s+/)[0] || 'Coach'
  // Time-based greeting + date are computed AFTER mount (client-only) to avoid an SSR/client
  // timezone hydration mismatch (React #418). Empty until mounted, then filled in.
  const [greeting, setGreeting] = useState('')
  const [dateLine, setDateLine] = useState('')
  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening')
    setDateLine(format(now, 'EEEE, MMMM d'))
  }, [])

  // Honest greeting subline from real loaded data.
  const sessionsToday = today.length
  const subParts: string[] = []
  if (!loading && !error) {
    subParts.push(`${sessionsToday} session${sessionsToday === 1 ? '' : 's'} today`)
    subParts.push(`${unread} unread message${unread === 1 ? '' : 's'}`)
  }

  return (
    <div className="coach-dash-stagger flex flex-col gap-6">
      <WelcomeGuide coachFirst={coachFirst} />
      <div className="flex flex-col gap-1.5">
        <GreetingBar coachFirst={coachFirst} dateLine={dateLine} greeting={greeting} next={nextUp} />
        {subParts.length ? (
          <p className="font-[family-name:var(--font-display)] text-[14px] font-semibold text-[var(--text-tertiary)]">
            {subParts.join(' · ')}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-[16px] border-[3px] border-[var(--border-default)] bg-[var(--bg-muted)] shadow-[var(--shadow-sm)]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="card-gloss rounded-[16px] px-5 py-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--text-primary)]">
            Couldn’t load your dashboard
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-tertiary)]">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void fetchAll()}
            className="btn-primary-gloss mt-3 inline-flex items-center justify-center rounded-[10px] border-[3px] border-[var(--border-default)] px-4 py-2 font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-on-accent)]"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Active students"
            value={String(s.activeClientsCount)}
            color="yellow"
            trend={s.trends?.activeClients}
            note="In your dojo"
          />
          <StatTile
            label="Revenue (month)"
            value={formatCents(s.revenueMonthCents)}
            color="teal"
            trend={s.trends?.revenueMonth}
            note="This month so far"
          />
          <StatTile
            label="Sessions this week"
            value={String(s.sessionsThisWeek)}
            color="violet"
            trend={s.trends?.sessionsThisWeek}
            note="Booked Mon–Sun"
          />
          <StatTile
            label="Pending invoices"
            value={String(s.pendingInvoicesCount)}
            color="coral"
            note={s.pendingInvoicesCount > 0 ? 'Awaiting payment' : 'All paid up'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <TodayPanel items={today} />
          {!loading && !error && <GettingStarted steps={steps} />}
        </div>
        <div className="flex flex-col gap-4">
          {!loading && !error && s.activeClientsCount > 0 && (
            <MonthlyCard
              revenueCents={s.revenueMonthCents}
              trend={s.trends?.revenueMonth}
              activeClients={s.activeClientsCount}
            />
          )}
          {!loading && !error && <AttentionStrip attention={attention} pendingInvoicesCount={s.pendingInvoicesCount} />}
          {!loading && !error && (
            <ActivityCard
              attention={attention}
              badges={badges}
              programsCompleteOf={{ done: stepsDone, total: steps.length }}
            />
          )}
          <MessagesPeek items={msgs} unreadTotal={unread} />
        </div>
      </div>

      {!loading && !error && <QuickActions />}
    </div>
  )
}
