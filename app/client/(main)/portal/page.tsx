import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { differenceInCalendarDays, differenceInMinutes, format, formatDistanceToNow, isAfter, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import type { ClientWorkspaceBranding } from '@/lib/client-workspace-branding'
import type { ClientPortalTodayCheckin } from '@/lib/client-portal-bundle'
import { normalizeEmail } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { ClientPortalDailyCheckIn } from '@/components/client/ClientPortalDailyCheckIn'
import { PortalBrandedHero } from '@/components/client/PortalBrandedHero'
import { AnimatedBar } from '@/components/client/AnimatedBar'
import { PortalSessionRequestBar } from '@/components/client/PortalSessionRequestBar'
import { cn } from '@/lib/utils'
import { goalProgressPercent } from '@/lib/goal-progress'
import { getLevelFromXp, getProgressPercent, getXpToNextLevel, LEVELS } from '@/lib/xp-system'
import { portalGreetingLine } from '@/lib/portal-time-greeting'

export const dynamic = 'force-dynamic'

function messagePreview(content: string | null, messageType: string | null): string {
  if (messageType === 'invoice') return 'Invoice from your coach'
  if (messageType === 'session') return 'Session update from your coach'
  if (messageType === 'session_request') return 'Session request sent'
  if (messageType === 'testimonial_request') return 'Your coach invited you to leave a review'
  const raw = (content ?? '').trim()
  if (!raw) return 'Message'
  const singleLine = raw.replace(/\s+/g, ' ')
  return singleLine.length > 60 ? `${singleLine.slice(0, 60)}…` : singleLine
}

function sessionTypeLabel(t: string | null | undefined): string {
  if (t === 'in_person') return 'In person'
  if (t === 'video' || t === 'phone') return 'Video'
  return 'Session'
}

const GOAL_CATEGORY_STYLE: Record<string, string> = {
  fitness: 'bg-[var(--info-bg)] text-[var(--info)]',
  nutrition: 'bg-[var(--success-bg)] text-[var(--success)]',
  mindset: 'bg-[var(--accent-light)] text-[var(--cp-accent)]',
  business: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  health: 'bg-[var(--error-bg)] text-[var(--error)]',
  performance: 'bg-[var(--info-bg)] text-[var(--info)]',
  general: 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
}

function assignmentEmoji(type: string | null | undefined): { emoji: string; bg: string } {
  const t = (type ?? 'text').toLowerCase()
  if (t === 'video') return { emoji: '🎥', bg: 'bg-[var(--error-bg)]' }
  if (t === 'checklist') return { emoji: '✅', bg: 'bg-[var(--success-bg)]' }
  return { emoji: '📝', bg: 'bg-[var(--info-bg)]' }
}

export default async function ClientPortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    redirect('/login')
  }

  const email = normalizeEmail(user.email)

  const [{ data: client, error: clientErr }, hdrs] = await Promise.all([
    supabase
      .from('clients')
      .select('id, first_name, status, workspace_id, coach_id')
      .eq('email', email)
      .maybeSingle(),
    headers(),
  ])

  if (clientErr || !client) {
    return (
      <main className="client-page-content mx-auto w-full max-w-[680px] px-4 py-6 md:px-6">
        <p className="text-[var(--text-tertiary)]">
          We couldn&apos;t find your client record. Contact your coach to get set up.
        </p>
      </main>
    )
  }

  if (client.status === 'paused' || client.status === 'completed') {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4 py-8">
        <Card variant="elevated" padding="lg" className="max-w-md text-center">
          <p className="text-[15px] text-[var(--text-primary)]">
            Your account is currently paused. Contact your coach for more information.
          </p>
        </Card>
      </main>
    )
  }

  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https')
  const origin = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  const portalRes = await fetch(`${origin}/api/client/portal-data`, {
    headers: { cookie: hdrs.get('cookie') ?? '' },
    cache: 'no-store',
  })
  const portalJson = (await portalRes.json().catch(() => ({}))) as {
    data?: Record<string, unknown>
    error?: string
  }

  if (!portalRes.ok || !portalJson.data) {
    return (
      <main className="client-page-content mx-auto w-full max-w-[680px] px-4 py-6 md:px-6">
        <p className="text-[var(--text-tertiary)]">
          {typeof portalJson.error === 'string'
            ? portalJson.error
            : 'Could not load your portal. Refresh the page to try again.'}
        </p>
      </main>
    )
  }

  const pd = portalJson.data
  const firstName = typeof pd.firstName === 'string' ? pd.firstName : client.first_name?.trim() || 'there'
  const branding = pd.branding as ClientWorkspaceBranding | null
  const nextSession = (pd.nextSession as {
    scheduled_time?: string
    duration_minutes?: number | null
    session_type?: string | null
    notes?: string | null
  } | null) ?? null
  const pendingInvoices = (pd.pendingInvoices ?? []) as Array<{
    amount_cents?: number
    currency?: string
    session_packages?: { title?: string | null } | null
  }>
  const rewardsRow = pd.rewards as {
    total_xp?: number
    level?: number
    current_streak_days?: number
    assignments_completed?: number
  } | null
  const assignmentRows = (pd.assignmentRows ?? []) as Array<{
    id: string
    status: string
    due_at: string | null
    points_awarded: number | null
    assignment_templates: unknown
  }>
  const goalRows = (pd.goalRows ?? []) as Array<{
    id: string
    title: string
    status: string
    category: string
    target_value: number | null
    start_value: number | null
    current_value: number | null
    unit: string | null
    achieved_at: string | null
  }>
  const lastMessage = pd.lastMessage as {
    content: string | null
    message_type: string | null
    created_at: string
  } | null
  const messageUnreadCount = typeof pd.messageUnreadCount === 'number' ? pd.messageUnreadCount : 0
  const coachDisplayName = typeof pd.coachDisplayName === 'string' ? pd.coachDisplayName : 'Your coach'
  const programBlock = pd.programBlock as {
    title: string
    programId: string
    completed: number
    total: number
    lastActivity: string | null
  } | null
  const todayCheckin = pd.todayCheckin as ClientPortalTodayCheckin

  const now = new Date()

  const totalXp = rewardsRow?.total_xp ?? 0
  const levelInfo = getLevelFromXp(totalXp)
  const xpBarPct = getProgressPercent(totalXp)
  const xpToNext = getXpToNextLevel(totalXp)
  const nextLevelDef = LEVELS.find((l) => l.level === levelInfo.level + 1)
  const streak = rewardsRow?.current_streak_days ?? 0
  const doneHw = rewardsRow?.assignments_completed ?? 0

  const pendingInvoicesTotalCents = pendingInvoices.reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const pendingCurrency =
    pendingInvoices.find((r) => r.currency)?.currency ?? 'usd'

  const activeGoals = goalRows.filter((g) => g.status === 'active' || g.status === 'achieved')
  const portalGoals = activeGoals.slice(0, 3)
  const previewAssignments = assignmentRows.slice(0, 3)

  const hasBrandingContent = Boolean(
    branding?.logoUrl?.trim() ||
      branding?.brandTagline?.trim() ||
      branding?.clientWelcomeMessage?.trim() ||
      branding?.clientPortalHeading?.trim()
  )

  const sessionStart =
    nextSession?.scheduled_time && typeof nextSession.scheduled_time === 'string'
      ? parseISO(nextSession.scheduled_time)
      : null
  const minutesUntilStart =
    sessionStart && isAfter(sessionStart, now) ? differenceInMinutes(sessionStart, now) : null
  const hoursUntil =
    minutesUntilStart != null ? Math.floor(minutesUntilStart / 60) : null
  const minsRemainder = minutesUntilStart != null ? minutesUntilStart % 60 : null
  const within2h = minutesUntilStart != null && minutesUntilStart < 120
  const within24h = minutesUntilStart != null && minutesUntilStart < 24 * 60

  const durationMin = nextSession?.duration_minutes ?? 60

  return (
    <main className="client-page-content mx-auto w-full max-w-[1400px] px-4 pb-20 pt-4 md:px-6 md:pb-8 md:pt-6 lg:px-8 lg:pb-10 lg:pt-6 xl:px-10">

      {/* ══════════════════════════════════════════════
          MOBILE LAYOUT (hidden on lg+)
          ══════════════════════════════════════════════ */}
      <div className="lg:hidden px-0 pt-0 pb-24">

        {/* Section 1 — Compact greeting */}
        <div className="mb-3">
          <p className="text-[12px] text-[var(--text-tertiary)]">{format(now, 'EEEE, MMMM d, yyyy')}</p>
          <h1 className="text-[21px] font-bold tracking-[-0.03em] text-[var(--text-primary)] leading-tight">
            Hey, {firstName} 👋
          </h1>
        </div>

        {/* Section 2 — Next session card */}
        {sessionStart && nextSession ? (
          <div className="mb-3 overflow-hidden rounded-[12px] border border-[var(--border-default)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ background: 'var(--bg-subtle)' }}>
            <div className="flex items-center justify-between px-3 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-0.5">Next session</p>
                <p className="text-[15px] font-bold text-[var(--text-primary)]">{format(sessionStart, 'EEE, MMM d · h:mm a')}</p>
                <p className="text-[12px] text-[var(--text-tertiary)]">{sessionTypeLabel(nextSession.session_type)} · {nextSession.duration_minutes ?? 60} min with {coachDisplayName}</p>
              </div>
              <Link href="/client/sessions" className="rounded-[8px] bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-white">View</Link>
            </div>
          </div>
        ) : (
          <div className="mb-3 overflow-hidden rounded-[12px] border border-[var(--border-default)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ background: 'var(--bg-subtle)' }}>
            <div className="px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-0.5">Next session</p>
              <p className="text-[13px] text-[var(--text-tertiary)]">No upcoming sessions — request one below.</p>
            </div>
          </div>
        )}

        {/* Section 3 — Daily check-in */}
        <div className="mb-3 overflow-hidden rounded-[12px] border border-[var(--border-default)]" style={{ background: 'var(--bg-subtle)' }}>
          <div className="px-3 py-3">
            <ClientPortalDailyCheckIn firstName={firstName} serverToday={todayCheckin} />
          </div>
        </div>

        {/* Section 4 — Quick nav grid */}
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          {[
            { label: 'Programs', href: '/client/programs', emoji: '📚', sub: 'Your content', color: 'var(--accent-light)', textColor: 'var(--accent)' },
            { label: 'Sessions', href: '/client/sessions', emoji: '📅', sub: 'View schedule', color: 'var(--success-bg)', textColor: 'var(--success)' },
            { label: 'Goals', href: '/client/goals', emoji: '🎯', sub: `${activeGoals.length > 0 ? `${activeGoals.length} active` : 'Track progress'}`, color: 'color-mix(in srgb, #a855f7 12%, var(--bg-muted))', textColor: '#a855f7' },
            { label: 'Messages', href: '/client/messages', emoji: '💬', sub: messageUnreadCount > 0 ? `${messageUnreadCount} unread` : 'Chat with coach', color: 'var(--accent-light)', textColor: 'var(--accent)' },
            { label: 'Tasks', href: '/client/assignments', emoji: '✅', sub: assignmentRows.length > 0 ? `${assignmentRows.length} open` : 'Your tasks', color: 'var(--warning-bg)', textColor: 'var(--warning)' },
            { label: 'Invoices', href: '/client/invoices', emoji: '🧾', sub: pendingInvoices.length > 0 ? `${pendingInvoices.length} pending` : 'Billing', color: 'var(--bg-muted)', textColor: 'var(--text-tertiary)' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 rounded-[12px] border border-[var(--border-default)] px-3 py-3.5 transition-all duration-100 active:scale-[0.98]"
              style={{ background: 'var(--bg-subtle)' }}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: item.color }}>
                {item.emoji}
              </span>
              <span>
                <span className="block text-[14px] font-semibold text-[var(--text-primary)]">{item.label}</span>
                <span className="block text-[11px] text-[var(--text-tertiary)]">{item.sub}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Section 5 — Alert chips */}
        {(pendingInvoices.length > 0) ? (
          <div className="flex flex-wrap gap-2">
            {pendingInvoices.length > 0 ? (
              <Link
                href="/client/invoices"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]"
              >
                💰 {pendingInvoices.length} pending invoice{pendingInvoices.length !== 1 ? 's' : ''} — tap to view
              </Link>
            ) : null}
          </div>
        ) : null}

      </div>
      {/* END MOBILE LAYOUT */}

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT (hidden below lg)
          ══════════════════════════════════════════════ */}
      <div className="hidden lg:block">

      {/* Greeting */}
      <div className="mb-5 border-b border-[var(--border-subtle)] pb-5 lg:mb-6 lg:pb-6">
        <p className="text-[11px] font-medium text-[var(--text-tertiary)] lg:text-[13px]">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        <h1 className="mt-0.5 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] [font-family:var(--font-sora)] lg:mt-1 lg:text-[26px] xl:text-[28px]">
          {portalGreetingLine(firstName, now)}
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)] lg:mt-2 lg:text-[14px]">
          Here&apos;s everything in one place — sessions, tasks, progress, and messages with {coachDisplayName}.
        </p>
      </div>

      {/* Two-column grid: left ~60% / right 360px fixed on lg+ */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-5">
        {/* ── LEFT COLUMN ── */}
        <div className="client-portal-dash-stagger flex min-w-0 flex-col gap-6 md:gap-6">
          <ClientPortalDailyCheckIn firstName={firstName} serverToday={todayCheckin} />

          {hasBrandingContent ? (
            <PortalBrandedHero>
              <section className="rounded-[var(--radius-xl)] bg-[linear-gradient(135deg,var(--accent-light)_0%,transparent_100%)] px-6 py-6">
                {branding?.logoUrl?.trim() ? (
                  <div className="relative mb-3 size-12 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--cp-offwhite)]">
                    <Image
                      src={branding.logoUrl.trim()}
                      alt={
                        branding?.brandName?.trim()
                          ? `${branding.brandName.trim()} logo`
                          : 'Workspace logo'
                      }
                      fill
                      className="object-contain p-1"
                      sizes="48px"
                    />
                  </div>
                ) : null}
                {branding?.brandName?.trim() ? (
                  <p className="text-[20px] font-bold text-[var(--text-primary)]">{branding.brandName.trim()}</p>
                ) : null}
                {branding?.brandTagline?.trim() ? (
                  <p className="mt-1 text-[14px] italic text-[var(--text-tertiary)]">{branding.brandTagline.trim()}</p>
                ) : null}
                {branding?.clientWelcomeMessage?.trim() ? (
                  <p className="mt-3 text-[14px] leading-[1.7] text-[var(--text-secondary)]">
                    {branding.clientWelcomeMessage.trim()}
                  </p>
                ) : branding?.clientPortalHeading?.trim() ? (
                  <p className="mt-3 text-[14px] leading-[1.7] text-[var(--text-secondary)]">
                    {branding.clientPortalHeading.trim()}
                  </p>
                ) : null}
              </section>
            </PortalBrandedHero>
          ) : null}

          {pendingInvoices.length > 0 ? (
            <section className="rounded-[12px] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[box-shadow,transform] duration-200 lg:border-[var(--warning-border)] lg:hover:-translate-y-px lg:hover:shadow-[var(--shadow-md)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-[var(--warning)]">
                    💰 You have {pendingInvoices.length} pending invoice{pendingInvoices.length !== 1 ? 's' : ''}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
                    Total due:{' '}
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: pendingCurrency.toUpperCase() === 'USD' ? 'USD' : pendingCurrency,
                    }).format(pendingInvoicesTotalCents / 100)}
                  </p>
                  {pendingInvoices.length === 1 ? (
                    <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
                      {(pendingInvoices[0] as { session_packages?: { title?: string | null } | null }).session_packages
                        ?.title ?? 'Invoice'}
                    </p>
                  ) : null}
                </div>
                <Link
                  href="/client/invoices"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[13px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  View invoices
                </Link>
              </div>
            </section>
          ) : null}

          {/* ── NEXT SESSION ── */}
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              Upcoming session
            </p>
            {sessionStart && nextSession ? (
              <Card variant="default" padding="lg" className="overflow-hidden !p-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="p-4 lg:flex lg:items-center lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[16px] font-semibold text-[var(--text-primary)] lg:text-[16px] lg:font-bold">
                        {format(sessionStart, 'EEEE, MMMM d')}
                      </p>
                      <span className="rounded-full bg-[var(--accent-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cp-accent)]">
                        {sessionTypeLabel(nextSession.session_type)}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] text-[var(--text-secondary)] lg:text-[16px] lg:font-bold lg:text-[var(--text-primary)]">
                      {format(sessionStart, 'h:mm a')} · {durationMin} minutes
                    </p>
                    {within24h && !within2h && hoursUntil != null ? (
                      <p className="mt-1 text-[12px] font-medium text-[var(--cp-accent)]">
                        In {hoursUntil} hours {minsRemainder ?? 0} minutes
                      </p>
                    ) : null}
                    {nextSession.notes?.trim() ? (
                      <p className="mt-2 text-[13px] italic text-[var(--text-tertiary)]">{nextSession.notes.trim()}</p>
                    ) : null}
                  </div>
                  <Link
                    href="/client/sessions"
                    className="mt-3 inline-block shrink-0 text-[13px] font-medium text-[var(--cp-accent)] lg:mt-0"
                  >
                    View all sessions →
                  </Link>
                </div>
                {within2h ? (
                  <div className="bg-[var(--cp-accent)] px-4 py-2 text-center text-[13px] font-medium text-white">
                    Starting soon — get ready!
                  </div>
                ) : null}
              </Card>
            ) : (
              <p className="text-[14px] text-[var(--text-tertiary)]">Nothing scheduled yet. Request a session below.</p>
            )}
          </section>

          {/* Mobile-only rewards strip */}
          {rewardsRow ? (
            <section className="flex items-center gap-4 rounded-[12px] bg-[var(--bg-subtle)] px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:hidden">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[20px] font-bold text-[var(--text-on-accent)]">
                {levelInfo.level}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[var(--text-primary)]">
                  Level {levelInfo.level}: {levelInfo.name}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                  <AnimatedBar percent={xpBarPct} className="h-1.5 w-full" />
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                  {totalXp} XP
                  {nextLevelDef && xpToNext > 0 ? ` · ${xpToNext} to next level` : !nextLevelDef ? ' · Max level' : ''}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-[12px] text-[var(--text-tertiary)]">🔥 {streak} day streak</p>
                <p className="text-[12px] text-[var(--text-tertiary)]">✅ {doneHw} tasks done</p>
              </div>
            </section>
          ) : null}

          {/* Mobile-only program card */}
          {programBlock ? (
            <section className="lg:hidden">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Your program
              </p>
              <Card variant="default" padding="lg" className="shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[16px] font-semibold text-[var(--text-primary)]">{programBlock.title}</p>
                <div className="my-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                  <AnimatedBar
                    percent={
                      programBlock.total > 0
                        ? Math.min(100, Math.round((programBlock.completed / programBlock.total) * 100))
                        : 0
                    }
                    className="h-2 w-full"
                  />
                </div>
                <div className="flex justify-between text-[13px] text-[var(--text-tertiary)]">
                  <span>
                    {programBlock.completed} of {programBlock.total} modules complete
                  </span>
                  <span>
                    {programBlock.total > 0
                      ? `${Math.min(100, Math.round((programBlock.completed / programBlock.total) * 100))}%`
                      : '0%'}
                  </span>
                </div>
                {programBlock.lastActivity ? (
                  <p className="mt-2 text-[12px] text-[var(--text-quaternary)]">
                    Last activity: {programBlock.lastActivity}
                  </p>
                ) : null}
                <Link
                  href={`/client/programs/${programBlock.programId}`}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--cp-accent)] text-[14px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--cp-accent-hover)]"
                >
                  Continue program
                </Link>
              </Card>
            </section>
          ) : (
            <p className="text-[14px] leading-relaxed text-[var(--text-tertiary)] lg:hidden">
              Your coach will assign a program here soon. In the meantime, check your messages.
            </p>
          )}

          {/* ── ASSIGNMENTS PREVIEW ── */}
          {previewAssignments.length > 0 ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Tasks due
              </p>
              <Card variant="elevated" padding="default" className="overflow-hidden !p-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <ul className="divide-y divide-[var(--border-subtle)] px-1">
                  {previewAssignments.map((row) => {
                    const tmpl = row.assignment_templates as
                      | { title?: string; assignment_type?: string; points?: number }
                      | { title?: string; assignment_type?: string; points?: number }[]
                      | null
                    const tdata = Array.isArray(tmpl) ? tmpl[0] : tmpl
                    const title = tdata?.title ?? 'Task'
                    const typ = tdata?.assignment_type
                    const pts = tdata?.points ?? 0
                    const { emoji, bg } = assignmentEmoji(typ)
                    const due = row.due_at ? parseISO(row.due_at) : null
                    const dayDelta = due ? differenceInCalendarDays(due, now) : null
                    const overdue = dayDelta != null && dayDelta < 0
                    return (
                      <li key={row.id} className="flex min-h-14 items-center gap-3 py-2 pl-1 pr-1">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[15px]', bg)}>
                          {emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href="/client/assignments" className="text-[14px] font-medium text-[var(--text-primary)]">
                            {title}
                          </Link>
                          <p className="text-[12px] text-[var(--text-tertiary)]">
                            {due
                              ? overdue
                                ? `Overdue by ${Math.abs(dayDelta ?? 0)} days`
                                : dayDelta === 0
                                  ? 'Due today'
                                  : dayDelta === 1
                                    ? 'Due tomorrow'
                                    : `Due in ${dayDelta} days`
                              : 'No due date'}
                          </p>
                        </div>
                        {pts > 0 ? (
                          <span className="shrink-0 rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[12px] font-medium text-[var(--cp-accent)]">
                            +{pts} XP
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {assignmentRows.length > 3 ? (
                  <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                    <Link href="/client/assignments" className="text-[13px] font-medium text-[var(--cp-accent)]">
                      View all {assignmentRows.length} tasks →
                    </Link>
                  </div>
                ) : null}
              </Card>
            </section>
          ) : (
            <p className="text-[14px] leading-relaxed text-[var(--text-tertiary)]">
              You&apos;re all caught up! ✨ New tasks from your coach will appear here.
            </p>
          )}

          {/* ── GOALS PREVIEW ── */}
          {portalGoals.length > 0 ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                My goals
              </p>
              <Card variant="elevated" padding="lg" className="shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <ul className="space-y-3">
                  {portalGoals.map((g) => {
                    const pct =
                      g.status === 'achieved'
                        ? 100
                        : goalProgressPercent({
                            targetValue: g.target_value,
                            startValue: g.start_value,
                            currentValue: g.current_value,
                          }) ?? 0
                    const catCls = GOAL_CATEGORY_STYLE[g.category] ?? GOAL_CATEGORY_STYLE.general
                    return (
                      <li key={g.id} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', catCls)}>
                            {g.category}
                          </span>
                          {g.status === 'achieved' ? (
                            <span className="text-[12px] font-medium text-[var(--success)]">🏆 Achieved!</span>
                          ) : null}
                        </div>
                        <p className="text-[14px] font-medium text-[var(--text-primary)]">{g.title}</p>
                        {g.target_value != null ? (
                          <>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                              <AnimatedBar
                                percent={pct}
                                className="h-1 w-full"
                                fillClassName={g.status === 'achieved' ? 'bg-[var(--success)]' : 'bg-[var(--cp-accent)]'}
                              />
                            </div>
                            <p className="text-right text-[12px] text-[var(--text-tertiary)]">
                              {g.current_value ?? '—'} / {g.target_value} {g.unit ?? ''}
                            </p>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {activeGoals.length > 3 ? (
                  <Link href="/client/goals" className="mt-4 inline-block text-[13px] font-medium text-[var(--cp-accent)]">
                    View all goals →
                  </Link>
                ) : null}
              </Card>
            </section>
          ) : null}

          {/* Mobile-only messages card */}
          <section className="lg:hidden">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              Messages
            </p>
            <Card variant="elevated" padding="default" className="overflow-hidden !p-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <Link
                href="/client/messages"
                className="flex h-[72px] items-center gap-3 px-5 py-4 text-inherit no-underline transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
              >
                <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-light)] text-[13px] font-semibold text-[var(--cp-accent)]">
                  {branding?.logoUrl?.trim() ? (
                    <Image
                      src={branding.logoUrl.trim()}
                      alt={`${coachDisplayName} workspace logo`}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    coachDisplayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{coachDisplayName}</p>
                  {lastMessage ? (
                    <p className="truncate text-[13px] text-[var(--text-tertiary)]">
                      {messagePreview(lastMessage.content, lastMessage.message_type)}
                    </p>
                  ) : (
                    <p className="text-[14px] text-[var(--text-tertiary)]">
                      Your conversation with your coach lives here. They&apos;ll reach out soon.
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {messageUnreadCount > 0 ? (
                    <span className="mb-1 flex size-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--cp-accent)] text-[11px] font-semibold text-[var(--text-on-accent)]">
                      {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                    </span>
                  ) : null}
                  {lastMessage?.created_at ? (
                    <p className="text-[12px] text-[var(--text-quaternary)]">
                      {formatDistanceToNow(parseISO(lastMessage.created_at), { addSuffix: true })}
                    </p>
                  ) : null}
                </div>
              </Link>
            </Card>
          </section>

          <PortalSessionRequestBar />
        </div>

        {/* ── RIGHT RAIL (desktop only) ── */}
        <aside
          className="client-portal-dash-stagger mt-8 hidden min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:mt-0 lg:flex lg:self-start"
          aria-label="Dashboard summary"
        >
          {/* XP / Rewards */}
          {rewardsRow ? (
            <Card variant="elevated" padding="lg" className="shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                XP &amp; rewards
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[16px] font-bold text-[var(--text-on-accent)]">
                  {levelInfo.level}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{levelInfo.name}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                    <AnimatedBar percent={xpBarPct} className="h-1.5 w-full" />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    {totalXp} XP
                    {nextLevelDef && xpToNext > 0 ? ` · ${xpToNext} to next` : !nextLevelDef ? ' · Max level' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4">
                <div className="rounded-[10px] bg-[var(--bg-subtle)] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Streak</p>
                  <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                    🔥 {streak}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">day{streak !== 1 ? 's' : ''}</p>
                </div>
                <div className="rounded-[10px] bg-[var(--bg-subtle)] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Completed</p>
                  <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                    ✅ {doneHw}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">tasks done</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card variant="elevated" padding="lg" className="text-[13px] text-[var(--text-secondary)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              Complete tasks and check in to earn XP and level up.
            </Card>
          )}

          {/* Programs */}
          {programBlock ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Your program
              </p>
              <Card variant="default" padding="lg" className="shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{programBlock.title}</p>
                <div className="my-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                  <AnimatedBar
                    percent={
                      programBlock.total > 0
                        ? Math.min(100, Math.round((programBlock.completed / programBlock.total) * 100))
                        : 0
                    }
                    className="h-2 w-full"
                  />
                </div>
                <div className="flex justify-between text-[13px] text-[var(--text-tertiary)]">
                  <span>
                    {programBlock.completed} of {programBlock.total} modules
                  </span>
                  <span>
                    {programBlock.total > 0
                      ? `${Math.min(100, Math.round((programBlock.completed / programBlock.total) * 100))}%`
                      : '0%'}
                  </span>
                </div>
                {programBlock.lastActivity ? (
                  <p className="mt-2 text-[12px] text-[var(--text-quaternary)]">
                    Last activity: {programBlock.lastActivity}
                  </p>
                ) : null}
                <Link
                  href={`/client/programs/${programBlock.programId}`}
                  className="mt-4 flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--cp-accent)] text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--cp-accent-hover)]"
                >
                  Continue program
                </Link>
              </Card>
            </section>
          ) : null}

          {/* Latest message / coach card */}
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              Messages
            </p>
            <Card variant="elevated" padding="default" className="overflow-hidden !p-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <Link
                href="/client/messages"
                className="flex min-h-[72px] items-center gap-3 px-4 py-3 text-inherit no-underline transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
              >
                <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-light)] text-[13px] font-semibold text-[var(--cp-accent)]">
                  {branding?.logoUrl?.trim() ? (
                    <Image
                      src={branding.logoUrl.trim()}
                      alt={`${coachDisplayName} workspace logo`}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    coachDisplayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{coachDisplayName}</p>
                  {lastMessage ? (
                    <p className="truncate text-[12px] text-[var(--text-tertiary)]">
                      {messagePreview(lastMessage.content, lastMessage.message_type)}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      No messages yet.
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {messageUnreadCount > 0 ? (
                    <span className="mb-1 flex size-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--cp-accent)] text-[11px] font-semibold text-[var(--text-on-accent)]">
                      {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                    </span>
                  ) : null}
                  {lastMessage?.created_at ? (
                    <p className="text-[12px] text-[var(--text-quaternary)]">
                      {formatDistanceToNow(parseISO(lastMessage.created_at), { addSuffix: true })}
                    </p>
                  ) : null}
                </div>
              </Link>
              <div className="border-t border-[var(--border-subtle)] px-4 py-2.5">
                <Link
                  href="/client/messages"
                  className="flex h-9 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--cp-accent)] text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--cp-accent-hover)]"
                >
                  Open messages
                </Link>
              </div>
            </Card>
          </section>

          {/* At-a-glance stat tiles */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              At a glance
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Card variant="elevated" padding="default" className="!p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Level</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                  {levelInfo.level}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)]">{levelInfo.name}</p>
              </Card>
              <Card variant="elevated" padding="default" className="!p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Streak</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                  🔥 {streak}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">day{streak !== 1 ? 's' : ''}</p>
              </Card>
              <Card variant="elevated" padding="default" className="!p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Tasks</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                  {assignmentRows.length}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">open</p>
              </Card>
              <Card variant="elevated" padding="default" className="!p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Inbox</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                  {messageUnreadCount}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">unread</p>
              </Card>
            </div>
          </div>
        </aside>
      </div>

      </div>
      {/* END DESKTOP LAYOUT */}

    </main>
  )
}
