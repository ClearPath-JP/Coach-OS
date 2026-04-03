import { redirect } from 'next/navigation'
import Link from 'next/link'
import { addDays, differenceInCalendarDays, differenceInMinutes, format, formatDistanceToNow, isAfter, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'
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
  mindset: 'bg-[var(--accent-light)] text-[var(--accent)]',
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

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, first_name, status, workspace_id, coach_id')
    .eq('email', email)
    .maybeSingle()

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

  const firstName = client.first_name?.trim() || 'there'
  const now = new Date()
  const nowIso = now.toISOString()
  const thirtyDaysIso = addDays(now, 30).toISOString()

  const [
    brandingRes,
    nextSessionRes,
    pendingInvoiceRes,
    rewardsRes,
    assignmentsRes,
    goalsRes,
    lastMsgRes,
    unreadRes,
    coachRes,
    activeProgramRes,
  ] = await Promise.all([
    getClientWorkspaceBranding(user.email),
    supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status, session_type, notes')
      .eq('client_id', client.id)
      .gte('scheduled_time', nowIso)
      .lte('scheduled_time', thirtyDaysIso)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('session_invoices')
      .select('id, amount_cents, currency, status, created_at, session_packages(title, description)')
      .eq('client_id', client.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('client_rewards')
      .select('total_xp, level, current_streak_days, assignments_completed')
      .eq('client_id', client.id)
      .eq('workspace_id', client.workspace_id)
      .maybeSingle(),
    supabase
      .from('client_assignments')
      .select(
        'id, status, due_at, points_awarded, assignment_templates(title, assignment_type, points)'
      )
      .eq('client_id', client.id)
      .eq('workspace_id', client.workspace_id)
      .in('status', ['pending', 'returned'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('client_goals')
      .select(
        'id, title, status, category, target_value, start_value, current_value, unit, achieved_at'
      )
      .eq('client_id', client.id)
      .eq('workspace_id', client.workspace_id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('messages')
      .select('content, message_type, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null),
    supabase.from('profiles').select('display_name, full_name').eq('id', client.coach_id).maybeSingle(),
    supabase
      .from('client_programs')
      .select('id, program_id, status, updated_at')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const branding = brandingRes
  const nextSession = nextSessionRes.error ? null : nextSessionRes.data
  const pendingInvoices = pendingInvoiceRes.error ? [] : (pendingInvoiceRes.data ?? [])
  const rewardsRow = rewardsRes.error ? null : rewardsRes.data
  const assignmentRows = assignmentsRes.error ? [] : (assignmentsRes.data ?? [])
  const goalRows = goalsRes.error ? [] : (goalsRes.data ?? [])
  const lastMessage = lastMsgRes.error ? null : lastMsgRes.data
  const messageUnreadCount = unreadRes.error ? 0 : (unreadRes.count ?? 0)
  const coachProfile = coachRes.error ? null : coachRes.data

  const coachDisplayName =
    branding?.brandName?.trim() ||
    coachProfile?.display_name?.trim() ||
    coachProfile?.full_name?.trim() ||
    'Your coach'

  let programBlock: {
    title: string
    programId: string
    completed: number
    total: number
    lastActivity: string | null
  } | null = null

  if (!activeProgramRes.error && activeProgramRes.data) {
    const cp = activeProgramRes.data
    const { data: programRow } = await supabase
      .from('programs')
      .select('id, title, total_modules')
      .eq('id', cp.program_id)
      .maybeSingle()
    if (programRow) {
      const { data: progressRows } = await supabase
        .from('program_progress')
        .select('completed_at')
        .eq('client_program_id', cp.id)
      const completed = (progressRows ?? []).filter((r) => r.completed_at != null).length
      const total = programRow.total_modules ?? 0
      const { data: lastDone } = await supabase
        .from('program_progress')
        .select('completed_at')
        .eq('client_program_id', cp.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      let lastActivity: string | null = null
      if (lastDone?.completed_at) {
        lastActivity = formatDistanceToNow(parseISO(lastDone.completed_at), { addSuffix: true })
      }
      programBlock = {
        title: programRow.title ?? 'Your program',
        programId: programRow.id,
        completed,
        total,
        lastActivity,
      }
    }
  }

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

  const sessionStart = nextSession?.scheduled_time ? parseISO(nextSession.scheduled_time) : null
  const minutesUntilStart =
    sessionStart && isAfter(sessionStart, now) ? differenceInMinutes(sessionStart, now) : null
  const hoursUntil =
    minutesUntilStart != null ? Math.floor(minutesUntilStart / 60) : null
  const minsRemainder = minutesUntilStart != null ? minutesUntilStart % 60 : null
  const within2h = minutesUntilStart != null && minutesUntilStart < 120
  const within24h = minutesUntilStart != null && minutesUntilStart < 24 * 60

  const durationMin = nextSession?.duration_minutes ?? 60

  return (
    <main className="client-page-content mx-auto w-full max-w-[680px] px-4 pb-20 pt-4 md:px-6 md:pb-8 md:pt-6 lg:max-w-none lg:px-8 lg:pb-10 lg:pt-6 xl:px-10">
      <div className="mb-6 hidden border-b border-[var(--border-subtle)] pb-6 lg:block">
        <p className="text-[13px] font-medium text-[var(--text-tertiary)]">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] [font-family:var(--font-sora)] xl:text-[28px]">
          {portalGreetingLine(firstName, now)}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
          Here&apos;s everything in one place — sessions, tasks, progress, and messages with {coachDisplayName}.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:gap-10">
        <div className="client-portal-dash-stagger flex min-w-0 flex-col gap-6 md:gap-6">
        {nextSessionRes.error ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Could not load upcoming session. Refresh the page to try again.
          </p>
        ) : null}

        <ClientPortalDailyCheckIn firstName={firstName} />

        {hasBrandingContent ? (
          <PortalBrandedHero>
            <section className="rounded-[var(--radius-xl)] bg-[linear-gradient(135deg,var(--accent-light)_0%,transparent_100%)] px-6 py-6">
              {branding?.logoUrl?.trim() ? (
                <div className="relative mb-3 size-12 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={branding.logoUrl.trim()} alt="" className="size-full object-contain p-1" />
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
          <section className="rounded-[var(--radius-lg)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 shadow-[var(--shadow-xs)] transition-[box-shadow,transform] duration-200 lg:border-[var(--warning-border)] lg:shadow-[var(--shadow-sm)] lg:hover:-translate-y-px lg:hover:shadow-[var(--shadow-md)]">
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
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 text-[13px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                View invoices
              </Link>
            </div>
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Upcoming session
          </p>
          {sessionStart && nextSession ? (
            <Card variant="default" padding="lg" className="overflow-hidden p-0">
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[16px] font-semibold text-[var(--text-primary)]">
                    {format(sessionStart, 'EEEE, MMMM d')}
                  </p>
                  <span className="rounded-full bg-[var(--accent-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                    {sessionTypeLabel(nextSession.session_type)}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
                  {format(sessionStart, 'h:mm a')} · {durationMin} minutes
                </p>
                {within24h && !within2h && hoursUntil != null ? (
                  <p className="mt-1 text-[12px] font-medium text-[var(--accent)]">
                    In {hoursUntil} hours {minsRemainder ?? 0} minutes
                  </p>
                ) : null}
                {nextSession.notes?.trim() ? (
                  <p className="mt-2 text-[13px] italic text-[var(--text-tertiary)]">{nextSession.notes.trim()}</p>
                ) : null}
                <Link href="/client/sessions" className="mt-3 inline-block text-[13px] font-medium text-[var(--accent)]">
                  View all sessions →
                </Link>
              </div>
              {within2h ? (
                <div className="bg-[var(--accent)] px-4 py-2 text-center text-[13px] font-medium text-white">
                  Starting soon — get ready!
                </div>
              ) : null}
            </Card>
          ) : (
            <p className="text-[14px] text-[var(--text-tertiary)]">Nothing scheduled yet. Request a session below.</p>
          )}
        </section>

        {programBlock ? (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Your program
            </p>
            <Card variant="default" padding="lg">
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
                className="mt-4 flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[14px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                Continue program
              </Link>
            </Card>
          </section>
        ) : !activeProgramRes.error && !activeProgramRes.data ? (
          <p className="text-[14px] leading-relaxed text-[var(--text-tertiary)]">
            Your coach will assign a program here soon. In the meantime, check your messages.
          </p>
        ) : null}

        {rewardsRes.error ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Could not load rewards. Refresh the page to try again.
          </p>
        ) : rewardsRow ? (
          <section className="flex items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] px-4 py-4 lg:hidden">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[20px] font-bold text-[var(--text-on-accent)]">
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

        {assignmentsRes.error ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Could not load tasks. Refresh the page to try again.
          </p>
        ) : previewAssignments.length > 0 ? (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Tasks due
            </p>
            <Card variant="elevated" padding="default" className="overflow-hidden !p-0">
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
                      <span className="shrink-0 rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[12px] font-medium text-[var(--accent)]">
                        +{pts} XP
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {assignmentRows.length > 3 ? (
              <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                <Link href="/client/assignments" className="text-[13px] font-medium text-[var(--accent)]">
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

        {portalGoals.length > 0 ? (
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              My goals
            </p>
            <Card variant="elevated" padding="lg">
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
                            fillClassName={g.status === 'achieved' ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}
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
              <Link href="/client/goals" className="mt-4 inline-block text-[13px] font-medium text-[var(--accent)]">
                View all goals →
              </Link>
            ) : null}
            </Card>
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Messages
          </p>
          <Card variant="elevated" padding="default" className="overflow-hidden !p-0">
          <Link
            href="/client/messages"
            className="flex h-[72px] items-center gap-3 px-5 py-4 text-inherit no-underline transition-colors duration-150 hover:bg-[var(--bg-subtle)]"
          >
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-light)] text-[13px] font-semibold text-[var(--accent)]">
              {branding?.logoUrl?.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl.trim()} alt="" className="size-full object-cover" />
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
                <span className="mb-1 flex size-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-[var(--text-on-accent)]">
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

        <aside
          className="client-portal-dash-stagger mt-8 hidden min-w-0 flex-col gap-4 lg:sticky lg:top-5 lg:mt-0 lg:flex lg:self-start"
          aria-label="Dashboard summary"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            At a glance
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Card variant="elevated" padding="default" className="!p-3">
              <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Level</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                {levelInfo.level}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)]">{levelInfo.name}</p>
            </Card>
            <Card variant="elevated" padding="default" className="!p-3">
              <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Streak</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                🔥 {streak}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">day{streak !== 1 ? 's' : ''}</p>
            </Card>
            <Card variant="elevated" padding="default" className="!p-3">
              <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Tasks</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                {assignmentRows.length}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">open</p>
            </Card>
            <Card variant="elevated" padding="default" className="!p-3">
              <p className="text-[11px] font-medium text-[var(--text-tertiary)]">Inbox</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)] [font-family:var(--font-sora)]">
                {messageUnreadCount}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">unread</p>
            </Card>
          </div>

          {!rewardsRes.error && rewardsRow ? (
            <Card variant="elevated" padding="lg">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                XP progress
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[16px] font-bold text-[var(--text-on-accent)]">
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
              <div className="mt-4 flex gap-3 border-t border-[var(--border-subtle)] pt-4 text-[12px] text-[var(--text-tertiary)]">
                <span>🔥 {streak} streak</span>
                <span>✅ {doneHw} done</span>
              </div>
            </Card>
          ) : !rewardsRes.error ? (
            <Card variant="elevated" padding="lg" className="text-[13px] text-[var(--text-secondary)]">
              Complete tasks and check in to earn XP and level up.
            </Card>
          ) : null}

          <Card variant="elevated" padding="lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Your coach
            </p>
            <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{coachDisplayName}</p>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              Questions or scheduling? Message your coach anytime.
            </p>
            <Link
              href="/client/messages"
              className="mt-4 flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[13px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              Open messages
            </Link>
          </Card>
        </aside>
      </div>
    </main>
  )
}
