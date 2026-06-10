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
import { PortalLocalDate, PortalLocalGreeting } from '@/components/client/PortalLocalDate'

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

function formatMoney(cents: number, currency: string | null | undefined): string {
  const amount = (cents ?? 0) / 100
  const code = (currency ?? 'usd').trim().toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

function sessionTypeLabel(t: string | null | undefined): string {
  if (t === 'in_person') return 'In person'
  if (t === 'video' || t === 'phone') return 'Video'
  return 'Session'
}

function assignmentEmoji(type: string | null | undefined): { emoji: string } {
  const t = (type ?? 'text').toLowerCase()
  if (t === 'video') return { emoji: '🎥' }
  if (t === 'checklist') return { emoji: '✅' }
  return { emoji: '📝' }
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
          MOBILE LAYOUT (hidden on lg+) — DOJO ARCADE
          ══════════════════════════════════════════════ */}
      <div className="lg:hidden px-0 pt-0 pb-24">

        {/* Section 1 — Greeting (date computed client-side — server clock is UTC) */}
        <div className="mb-4">
          <PortalLocalDate className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]" />
          <h1 className="mt-1 text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--ink)] font-[family-name:var(--font-display)]">
            Welcome back, {firstName} 👊
          </h1>
        </div>

        {/* Section 2 — XP / streak banner (REAL data; only when rewards exist) */}
        {rewardsRow ? (
          <div className="tile-teal mb-4 p-4">
            <div className="flex items-center gap-3">
              <div className="arcade-medal shrink-0" style={{ background: 'var(--belt-yellow)' }} aria-hidden>🔥</div>
              <div className="min-w-0 flex-1 text-white">
                <p className="text-[18px] font-extrabold leading-tight tracking-[-0.02em] font-[family-name:var(--font-display)]">
                  {streak > 0 ? `${streak}-day streak!` : `Level ${levelInfo.level} · ${levelInfo.name}`}
                </p>
                <p className="text-[12px] font-semibold leading-snug text-white/85 font-[family-name:var(--font-display)]">
                  {streak > 0 ? `${levelInfo.name} · keep training` : 'Check in and finish tasks to build a streak'}
                </p>
              </div>
              <div className="shrink-0 text-center text-white">
                <p className="text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums font-[family-name:var(--font-display)]" style={{ color: 'var(--belt-yellow)' }}>
                  {totalXp}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 font-[family-name:var(--font-display)]">XP total</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Section 3 — Next session card (REAL; 1-on-1 session, no fabricated capacity) */}
        {sessionStart && nextSession ? (
          <div className="tile-yellow mb-4 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink)]/55 font-[family-name:var(--font-display)]">Next session</p>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ink)] font-[family-name:var(--font-display)]">
                  {format(sessionStart, 'EEE, MMM d')}
                </p>
                <p className="text-[13px] font-semibold text-[var(--ink)]/75 font-[family-name:var(--font-display)]">
                  {sessionTypeLabel(nextSession.session_type)} · {durationMin} min with {coachDisplayName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {within2h ? (
                    <span className="arcade-badge arcade-badge-coral">Starting soon</span>
                  ) : within24h && hoursUntil != null ? (
                    <span className="arcade-badge">In {hoursUntil}h {minsRemainder ?? 0}m</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-center">
                <p className="text-[28px] font-extrabold leading-none tracking-[-0.04em] text-[var(--ink)] font-[family-name:var(--font-display)]">
                  {format(sessionStart, 'h:mm')}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]/55 font-[family-name:var(--font-display)]">
                  {format(sessionStart, 'a')}
                </p>
              </div>
            </div>
            {nextSession.notes?.trim() ? (
              <p className="mt-2 text-[12px] italic text-[var(--ink)]/70 font-[family-name:var(--font-display)]">{nextSession.notes.trim()}</p>
            ) : null}
            <Link href="/client/sessions" className="mt-3 flex h-11 w-full items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--belt-blue)] text-[14px] font-extrabold text-white shadow-[3px_3px_0_var(--ink)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-[family-name:var(--font-display)]">
              View session details →
            </Link>
          </div>
        ) : (
          <div className="mb-4 rounded-[16px] border-[3px] border-[var(--ink)] bg-white p-4 shadow-[5px_5px_0_var(--ink)]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Next session</p>
            <p className="text-[14px] font-semibold text-[var(--text-secondary)] font-[family-name:var(--font-display)]">No upcoming sessions — request one below.</p>
          </div>
        )}

        {/* Section 4 — Daily check-in */}
        <div className="mb-4 overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-white p-4 shadow-[5px_5px_0_var(--ink)]">
          <ClientPortalDailyCheckIn firstName={firstName} serverToday={todayCheckin} />
        </div>

        {/* Section 5 — Pending invoices alert (REAL) */}
        {pendingInvoices.length > 0 ? (
          <Link
            href="/client/invoices"
            className="arcade-lift mb-4 flex items-center gap-3 rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--belt-coral)] p-4 text-white shadow-[5px_5px_0_var(--ink)]"
          >
            <span className="text-[22px]" aria-hidden>💰</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold leading-tight font-[family-name:var(--font-display)]">
                {pendingInvoices.length} pending invoice{pendingInvoices.length !== 1 ? 's' : ''}
              </span>
              <span className="block text-[12px] font-semibold text-white/85 font-[family-name:var(--font-display)]">
                {formatMoney(pendingInvoicesTotalCents, pendingCurrency)}{' '}due — tap to view
              </span>
            </span>
          </Link>
        ) : null}

        {/* Section 6 — Tasks due (REAL) */}
        {previewAssignments.length > 0 ? (
          <div className="mb-4 overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-white shadow-[5px_5px_0_var(--ink)]">
            <p className="px-4 pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Tasks due</p>
            <ul className="px-2 py-2">
              {previewAssignments.map((row) => {
                const tmpl = row.assignment_templates as
                  | { title?: string; assignment_type?: string; points?: number }
                  | { title?: string; assignment_type?: string; points?: number }[]
                  | null
                const tdata = Array.isArray(tmpl) ? tmpl[0] : tmpl
                const title = tdata?.title ?? 'Task'
                const typ = tdata?.assignment_type
                const pts = tdata?.points ?? 0
                const { emoji } = assignmentEmoji(typ)
                const due = row.due_at ? parseISO(row.due_at) : null
                const dayDelta = due ? differenceInCalendarDays(due, now) : null
                const overdue = dayDelta != null && dayDelta < 0
                return (
                  <li key={row.id} className="flex min-h-14 items-center gap-3 px-2 py-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-[var(--ink)] bg-[var(--belt-yellow)] text-[16px]" aria-hidden>
                      {emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-[var(--ink)] font-[family-name:var(--font-display)]">{title}</span>
                      <span className="block text-[12px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                        {due
                          ? overdue
                            ? `Overdue by ${Math.abs(dayDelta ?? 0)} days`
                            : dayDelta === 0
                              ? 'Due today'
                              : dayDelta === 1
                                ? 'Due tomorrow'
                                : `Due in ${dayDelta} days`
                          : 'No due date'}
                      </span>
                    </div>
                    {pts > 0 ? (
                      <span className="arcade-badge arcade-badge-teal shrink-0">+{pts} XP</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {/* Section 7 — Belts & ranks placeholder (HONEST: no belt/achievement data yet) */}
        <div className="mb-4 rounded-[16px] border-[3px] border-dashed border-[var(--ink)]/30 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)]/30 bg-[var(--bg-muted)] text-[24px]" aria-hidden>🥋</span>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-[var(--ink)] font-[family-name:var(--font-display)]">Belts &amp; medals</p>
              <p className="text-[12px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Rank tracking &amp; achievements coming soon.</p>
            </div>
          </div>
        </div>

        {/* Section 8 — Quick actions (REAL routes) */}
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Quick actions</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Book a class', href: '/client/classes', emoji: '📅', tile: 'tile-yellow' },
            { label: 'Message coach', href: '/client/messages', emoji: '💬', tile: 'tile-violet' },
            { label: 'My videos', href: '/client/videos', emoji: '🎥', tile: 'tile-teal' },
            { label: 'Invoices', href: '/client/invoices', emoji: '🧾', tile: 'tile-blue' },
            { label: 'Programs', href: '/client/programs', emoji: '📚', tile: 'arcade-tile' },
            { label: 'Passes', href: '/client/passes', emoji: '🎟️', tile: 'arcade-tile' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(item.tile, 'arcade-lift flex items-center gap-3 p-3.5')}
            >
              <span className="text-[24px]" aria-hidden>{item.emoji}</span>
              <span className="text-[14px] font-extrabold tracking-[-0.01em] font-[family-name:var(--font-display)]">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
      {/* END MOBILE LAYOUT */}

      {/* ══════════════════════════════════════════════
          DESKTOP LAYOUT (hidden below lg)
          ══════════════════════════════════════════════ */}
      <div className="hidden lg:block">

      {/* Greeting (date + time-of-day greeting computed client-side — server clock is UTC) */}
      <div className="mb-6 lg:mb-7">
        <PortalLocalDate className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]" />
        <PortalLocalGreeting
          firstName={firstName}
          className="mt-1 text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--ink)] font-[family-name:var(--font-display)] lg:text-[32px] xl:text-[34px]"
        />
        <p className="mt-2 max-w-xl text-[14px] font-semibold leading-relaxed text-[var(--text-secondary)] font-[family-name:var(--font-display)]">
          Everything in one place — sessions, tasks, progress, and messages with {coachDisplayName}.
        </p>
      </div>

      {/* Two-column grid: left ~60% / right 360px fixed on lg+ */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-5">
        {/* ── LEFT COLUMN ── */}
        <div className="client-portal-dash-stagger flex min-w-0 flex-col gap-6 md:gap-6">
          <ClientPortalDailyCheckIn firstName={firstName} serverToday={todayCheckin} />

          {hasBrandingContent ? (
            <PortalBrandedHero>
              <section className="rounded-[16px] border-[3px] border-[var(--ink)] bg-white px-6 py-6 shadow-[5px_5px_0_var(--ink)]">
                {branding?.logoUrl?.trim() ? (
                  <div className="relative mb-3 size-12 overflow-hidden rounded-[10px] border-[3px] border-[var(--ink)] bg-[var(--cp-offwhite)]">
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
                  <p className="text-[22px] font-extrabold tracking-[-0.02em] text-[var(--ink)] font-[family-name:var(--font-display)]">{branding.brandName.trim()}</p>
                ) : null}
                {branding?.brandTagline?.trim() ? (
                  <p className="mt-1 text-[14px] font-semibold italic text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">{branding.brandTagline.trim()}</p>
                ) : null}
                {branding?.clientWelcomeMessage?.trim() ? (
                  <p className="mt-3 text-[14px] font-medium leading-[1.7] text-[var(--text-secondary)] font-[family-name:var(--font-display)]">
                    {branding.clientWelcomeMessage.trim()}
                  </p>
                ) : branding?.clientPortalHeading?.trim() ? (
                  <p className="mt-3 text-[14px] font-medium leading-[1.7] text-[var(--text-secondary)] font-[family-name:var(--font-display)]">
                    {branding.clientPortalHeading.trim()}
                  </p>
                ) : null}
              </section>
            </PortalBrandedHero>
          ) : null}

          {pendingInvoices.length > 0 ? (
            <section className="rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--belt-coral)] p-5 text-white shadow-[5px_5px_0_var(--ink)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-[24px]" aria-hidden>💰</span>
                  <div>
                    <p className="text-[17px] font-extrabold leading-tight tracking-[-0.01em] font-[family-name:var(--font-display)]">
                      {pendingInvoices.length} pending invoice{pendingInvoices.length !== 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-white/85 font-[family-name:var(--font-display)]">
                      Total due: {formatMoney(pendingInvoicesTotalCents, pendingCurrency)}
                    </p>
                    {pendingInvoices.length === 1 ? (
                      <p className="mt-1 text-[13px] font-semibold text-white/85 font-[family-name:var(--font-display)]">
                        {(pendingInvoices[0] as { session_packages?: { title?: string | null } | null }).session_packages
                          ?.title ?? 'Invoice'}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Link
                  href="/client/invoices"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-white px-4 text-[14px] font-extrabold text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_var(--ink)] font-[family-name:var(--font-display)]"
                >
                  View invoices
                </Link>
              </div>
            </section>
          ) : null}

          {/* ── NEXT SESSION (REAL; 1-on-1 session, no fabricated capacity) ── */}
          <section>
            {sessionStart && nextSession ? (
              <div className="tile-yellow overflow-hidden">
                <div className="p-5 lg:flex lg:items-center lg:gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink)]/55 font-[family-name:var(--font-display)]">
                        Next session
                      </p>
                      <span className="arcade-badge">{sessionTypeLabel(nextSession.session_type)}</span>
                    </div>
                    <p className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ink)] font-[family-name:var(--font-display)]">
                      {format(sessionStart, 'EEEE, MMMM d')}
                    </p>
                    <p className="mt-1 text-[15px] font-bold text-[var(--ink)]/80 font-[family-name:var(--font-display)]">
                      {format(sessionStart, 'h:mm a')} · {durationMin} minutes with {coachDisplayName}
                    </p>
                    {within24h && !within2h && hoursUntil != null ? (
                      <p className="mt-2 inline-flex">
                        <span className="arcade-badge arcade-badge-blue">In {hoursUntil}h {minsRemainder ?? 0}m</span>
                      </p>
                    ) : null}
                    {nextSession.notes?.trim() ? (
                      <p className="mt-2 text-[13px] italic text-[var(--ink)]/70 font-[family-name:var(--font-display)]">{nextSession.notes.trim()}</p>
                    ) : null}
                  </div>
                  <Link
                    href="/client/sessions"
                    className="mt-4 flex h-11 shrink-0 items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--belt-blue)] px-5 text-[14px] font-extrabold text-white shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_var(--ink)] font-[family-name:var(--font-display)] lg:mt-0"
                  >
                    View details →
                  </Link>
                </div>
                {within2h ? (
                  <div className="border-t-[3px] border-[var(--ink)] bg-[var(--belt-coral)] px-4 py-2 text-center text-[14px] font-extrabold text-white font-[family-name:var(--font-display)]">
                    Starting soon — get ready!
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[16px] border-[3px] border-[var(--ink)] bg-white p-5 shadow-[5px_5px_0_var(--ink)]">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Next session</p>
                <p className="text-[15px] font-semibold text-[var(--text-secondary)] font-[family-name:var(--font-display)]">Nothing scheduled yet. Request a session below.</p>
              </div>
            )}
          </section>

          {/* ── ASSIGNMENTS PREVIEW (REAL) ── */}
          {previewAssignments.length > 0 ? (
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                Tasks due
              </p>
              <div className="overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-white shadow-[5px_5px_0_var(--ink)]">
                <ul className="px-2 py-2">
                  {previewAssignments.map((row) => {
                    const tmpl = row.assignment_templates as
                      | { title?: string; assignment_type?: string; points?: number }
                      | { title?: string; assignment_type?: string; points?: number }[]
                      | null
                    const tdata = Array.isArray(tmpl) ? tmpl[0] : tmpl
                    const title = tdata?.title ?? 'Task'
                    const typ = tdata?.assignment_type
                    const pts = tdata?.points ?? 0
                    const { emoji } = assignmentEmoji(typ)
                    const due = row.due_at ? parseISO(row.due_at) : null
                    const dayDelta = due ? differenceInCalendarDays(due, now) : null
                    const overdue = dayDelta != null && dayDelta < 0
                    return (
                      <li key={row.id} className="flex min-h-14 items-center gap-3 px-2 py-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-[var(--ink)] bg-[var(--belt-yellow)] text-[16px]" aria-hidden>
                          {emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold text-[var(--ink)] font-[family-name:var(--font-display)]">
                            {title}
                          </span>
                          <p className={cn('text-[12px] font-semibold font-[family-name:var(--font-display)]', overdue ? 'text-[var(--belt-coral)]' : 'text-[var(--text-tertiary)]')}>
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
                          <span className="arcade-badge arcade-badge-teal shrink-0">+{pts} XP</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          ) : null}

          {/* ── GOALS PREVIEW (REAL) ── */}
          {portalGoals.length > 0 ? (
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                My goals
              </p>
              <div className="rounded-[16px] border-[3px] border-[var(--ink)] bg-white p-5 shadow-[5px_5px_0_var(--ink)]">
                <ul className="space-y-4">
                  {portalGoals.map((g) => {
                    const pct =
                      g.status === 'achieved'
                        ? 100
                        : goalProgressPercent({
                            targetValue: g.target_value,
                            startValue: g.start_value,
                            currentValue: g.current_value,
                          }) ?? 0
                    return (
                      <li key={g.id} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="arcade-badge capitalize">{g.category}</span>
                          {g.status === 'achieved' ? (
                            <span className="arcade-badge arcade-badge-teal">🏆 Achieved</span>
                          ) : null}
                        </div>
                        <p className="text-[15px] font-bold text-[var(--ink)] font-[family-name:var(--font-display)]">{g.title}</p>
                        {g.target_value != null ? (
                          <>
                            <div className="arcade-track">
                              <AnimatedBar
                                percent={pct}
                                className="h-full w-full !rounded-none border-0 bg-transparent"
                                fillClassName={g.status === 'achieved' ? 'arcade-fill' : 'arcade-fill-blue'}
                              />
                            </div>
                            <p className="text-right text-[12px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                              {g.current_value ?? '—'} / {g.target_value} {g.unit ?? ''}
                            </p>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {activeGoals.length > 3 ? (
                  <Link href="/client/goals" className="mt-4 inline-flex h-10 items-center text-[13px] font-extrabold text-[var(--cp-accent)] font-[family-name:var(--font-display)]">
                    View all goals →
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          <PortalSessionRequestBar />
        </div>

        {/* ── RIGHT RAIL (desktop only) ── */}
        <aside
          className="client-portal-dash-stagger mt-8 hidden min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:mt-0 lg:flex lg:self-start"
          aria-label="Dashboard summary"
        >
          {/* XP / Rewards (REAL data) */}
          {rewardsRow ? (
            <div className="tile-teal p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/75 font-[family-name:var(--font-display)]">
                  XP &amp; rewards
                </p>
                {streak > 0 ? <span className="arcade-streak">🔥 {streak}</span> : null}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] text-[20px] font-extrabold text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] font-[family-name:var(--font-display)]">
                  {levelInfo.level}
                </div>
                <div className="min-w-0 flex-1 text-white">
                  <p className="text-[14px] font-extrabold leading-tight font-[family-name:var(--font-display)]">{levelInfo.name}</p>
                  <div className="arcade-track mt-2">
                    <AnimatedBar percent={xpBarPct} className="h-full w-full !rounded-none border-0 bg-transparent" fillClassName="arcade-fill-yellow" />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-white/80 font-[family-name:var(--font-display)]">
                    {totalXp} XP
                    {nextLevelDef && xpToNext > 0 ? ` · ${xpToNext} to next` : !nextLevelDef ? ' · Max level' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border-[3px] border-[var(--ink)] bg-white px-3 py-2.5 text-[var(--ink)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Streak</p>
                  <p className="mt-1 text-[22px] font-extrabold tabular-nums leading-none font-[family-name:var(--font-display)]">
                    🔥 {streak}
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)] font-[family-name:var(--font-display)]">day{streak !== 1 ? 's' : ''}</p>
                </div>
                <div className="rounded-[12px] border-[3px] border-[var(--ink)] bg-white px-3 py-2.5 text-[var(--ink)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Completed</p>
                  <p className="mt-1 text-[22px] font-extrabold tabular-nums leading-none font-[family-name:var(--font-display)]">
                    ✅ {doneHw}
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)] font-[family-name:var(--font-display)]">tasks done</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] border-[3px] border-[var(--ink)] bg-white p-5 text-[14px] font-semibold text-[var(--text-secondary)] shadow-[5px_5px_0_var(--ink)] font-[family-name:var(--font-display)]">
              Complete tasks and check in to earn XP and level up.
            </div>
          )}

          {/* Belts & ranks placeholder (HONEST: no belt/achievement data yet) */}
          <div className="rounded-[16px] border-[3px] border-dashed border-[var(--ink)]/30 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)]/30 bg-[var(--bg-muted)] text-[24px]" aria-hidden>🥋</span>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-[var(--ink)] font-[family-name:var(--font-display)]">Belts &amp; medals</p>
                <p className="text-[12px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">Rank tracking &amp; achievements coming soon.</p>
              </div>
            </div>
          </div>

          {/* Programs (REAL) */}
          {programBlock ? (
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                Your program
              </p>
              <div className="rounded-[16px] border-[3px] border-[var(--ink)] bg-white p-5 shadow-[5px_5px_0_var(--ink)]">
                <p className="text-[16px] font-extrabold text-[var(--ink)] font-[family-name:var(--font-display)]">{programBlock.title}</p>
                <div className="arcade-track my-3">
                  <AnimatedBar
                    percent={
                      programBlock.total > 0
                        ? Math.min(100, Math.round((programBlock.completed / programBlock.total) * 100))
                        : 0
                    }
                    className="h-full w-full !rounded-none border-0 bg-transparent"
                    fillClassName="arcade-fill"
                  />
                </div>
                <div className="flex justify-between text-[13px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                  <span>
                    {programBlock.completed} of {programBlock.total} modules
                  </span>
                  <span className="text-[var(--ink)]">
                    {programBlock.total > 0
                      ? `${Math.min(100, Math.round((programBlock.completed / programBlock.total) * 100))}%`
                      : '0%'}
                  </span>
                </div>
                {programBlock.lastActivity ? (
                  <p className="mt-2 text-[12px] font-semibold text-[var(--text-quaternary)] font-[family-name:var(--font-display)]">
                    Last activity: {programBlock.lastActivity}
                  </p>
                ) : null}
                <Link
                  href={`/client/programs/${programBlock.programId}`}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--cp-accent)] text-[14px] font-extrabold text-white shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_var(--ink)] font-[family-name:var(--font-display)]"
                >
                  Continue program
                </Link>
              </div>
            </section>
          ) : null}

          {/* Latest message / coach card (REAL) */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
              Messages
            </p>
            <div className="overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-white shadow-[5px_5px_0_var(--ink)]">
              <Link
                href="/client/messages"
                className="flex min-h-[72px] items-center gap-3 px-4 py-3 text-inherit no-underline transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
              >
                <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--cp-accent)] text-[15px] font-extrabold text-white font-[family-name:var(--font-display)]">
                  {branding?.logoUrl?.trim() ? (
                    <Image
                      src={branding.logoUrl.trim()}
                      alt={`${coachDisplayName} workspace logo`}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    coachDisplayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold text-[var(--ink)] font-[family-name:var(--font-display)]">{coachDisplayName}</p>
                  {lastMessage ? (
                    <p className="truncate text-[12px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                      {messagePreview(lastMessage.content, lastMessage.message_type)}
                    </p>
                  ) : (
                    <p className="text-[12px] font-semibold text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
                      No messages yet.
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {messageUnreadCount > 0 ? (
                    <span className="mb-1 flex size-5 min-w-[20px] items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--belt-coral)] text-[11px] font-extrabold text-white font-[family-name:var(--font-display)]">
                      {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                    </span>
                  ) : null}
                  {lastMessage?.created_at ? (
                    <p className="text-[11px] font-semibold text-[var(--text-quaternary)] font-[family-name:var(--font-display)]">
                      {formatDistanceToNow(parseISO(lastMessage.created_at), { addSuffix: true })}
                    </p>
                  ) : null}
                </div>
              </Link>
              <div className="border-t-[3px] border-[var(--ink)] px-4 py-3">
                <Link
                  href="/client/messages"
                  className="flex h-10 w-full items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--cp-accent)] text-[13px] font-extrabold text-white shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_var(--ink)] font-[family-name:var(--font-display)]"
                >
                  Open messages
                </Link>
              </div>
            </div>
          </section>

          {/* At-a-glance stat tiles (REAL) */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[family-name:var(--font-display)]">
              At a glance
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="tile-violet p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]/60 font-[family-name:var(--font-display)]">Level</p>
                <p className="mt-1 text-[24px] font-extrabold tabular-nums leading-none text-[var(--ink)] font-[family-name:var(--font-display)]">
                  {levelInfo.level}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-snug text-[var(--ink)]/75 font-[family-name:var(--font-display)]">{levelInfo.name}</p>
              </div>
              <div className="tile-coral p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/75 font-[family-name:var(--font-display)]">Streak</p>
                <p className="mt-1 text-[24px] font-extrabold tabular-nums leading-none text-white font-[family-name:var(--font-display)]">
                  🔥 {streak}
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-white/80 font-[family-name:var(--font-display)]">day{streak !== 1 ? 's' : ''}</p>
              </div>
              <div className="tile-yellow p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]/60 font-[family-name:var(--font-display)]">Tasks</p>
                <p className="mt-1 text-[24px] font-extrabold tabular-nums leading-none text-[var(--ink)] font-[family-name:var(--font-display)]">
                  {assignmentRows.length}
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-[var(--ink)]/75 font-[family-name:var(--font-display)]">open</p>
              </div>
              <div className="tile-blue p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/75 font-[family-name:var(--font-display)]">Inbox</p>
                <p className="mt-1 text-[24px] font-extrabold tabular-nums leading-none text-white font-[family-name:var(--font-display)]">
                  {messageUnreadCount}
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-white/80 font-[family-name:var(--font-display)]">unread</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      </div>
      {/* END DESKTOP LAYOUT */}

    </main>
  )
}
