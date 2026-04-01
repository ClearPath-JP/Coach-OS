import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'
import { normalizeEmail } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { ClientWeekCalendar } from '@/components/client/ClientWeekCalendar'
import { RequestSessionButton } from '@/components/client/RequestSessionButton'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { getLevelFromXp, getProgressPercent, getXpToNextLevel, LEVELS } from '@/lib/xp-system'

export const dynamic = 'force-dynamic'

function messagePreview(content: string | null, messageType: string | null): string {
  if (messageType === 'invoice') return 'Invoice from your coach'
  if (messageType === 'session') return 'Session update from your coach'
  if (messageType === 'session_request') return 'Session request sent'
  const raw = (content ?? '').trim()
  if (!raw) return 'Message'
  const singleLine = raw.replace(/\s+/g, ' ')
  return singleLine.length > 60 ? `${singleLine.slice(0, 60)}…` : singleLine
}

function sessionTypeBadge(t: string | null | undefined): string {
  if (!t) return 'Session'
  const m: Record<string, string> = {
    video: 'Video call',
    phone: 'Phone',
    in_person: 'In person',
  }
  return m[t] ?? 'Session'
}

function portalGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function ClientPortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    redirect('/login')
  }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, first_name, status, workspace_id')
    .eq('email', normalizeEmail(user.email))
    .maybeSingle()

  if (error || !client) {
    return (
      <main className="p-6">
        <p className="text-[var(--text-tertiary)]">
          We couldn&apos;t find your client record. Contact your coach to get set up.
        </p>
      </main>
    )
  }

  if (client.status === 'paused' || client.status === 'completed') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card variant="elevated" padding="lg" className="max-w-md text-center">
          <p className="text-[15px] text-[var(--text-primary)]">
            Your account is currently paused. Contact your coach for more information.
          </p>
        </Card>
      </main>
    )
  }

  const firstName = client.first_name?.trim() || 'there'
  const branding = await getClientWorkspaceBranding(user.email)
  const coachLabel = branding?.brandName?.trim() || 'Your coach'
  const hour = new Date().getHours()
  const now = new Date().toISOString()

  const { data: nextSession } = await supabase
    .from('sessions')
    .select('id, scheduled_time, end_time, duration_minutes, status, session_type')
    .eq('client_id', client.id)
    .gte('scheduled_time', now)
    .in('status', ['pending', 'confirmed'])
    .order('scheduled_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { count: pendingInvoicesCount } = await supabase
    .from('session_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('status', 'pending')

  const { data: pendingInvoiceRows } = await supabase
    .from('session_invoices')
    .select('amount_cents, currency')
    .eq('client_id', client.id)
    .eq('status', 'pending')

  const pendingInvoicesTotalCents = (pendingInvoiceRows ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0)
  const pendingCurrency =
    (pendingInvoiceRows ?? []).find((r) => r.currency)?.currency ?? 'usd'

  const { count: messageUnreadCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null)

  const { data: lastMessage } = await supabase
    .from('messages')
    .select('content, message_type, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: activeAssignments } = await supabase
    .from('client_programs')
    .select('id, program_id, status')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const activeAssignment = activeAssignments?.[0] ?? null
  let progressTitle: string | null = null
  let progressCompleted = 0
  let progressTotal = 0
  let lastActivityLabel: string | null = null

  if (activeAssignment) {
    const { data: programRow } = await supabase
      .from('programs')
      .select('id, title, total_modules')
      .eq('id', activeAssignment.program_id)
      .maybeSingle()
    progressTitle = programRow?.title ?? 'Your program'
    progressTotal = programRow?.total_modules ?? 0
    const { data: progressRows } = await supabase
      .from('program_progress')
      .select('completed_at')
      .eq('client_program_id', activeAssignment.id)
    progressCompleted = (progressRows ?? []).filter((r) => r.completed_at != null).length

    const { data: lastDone } = await supabase
      .from('program_progress')
      .select('completed_at')
      .eq('client_program_id', activeAssignment.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastDone?.completed_at) {
      lastActivityLabel = formatDistanceToNow(parseISO(lastDone.completed_at), { addSuffix: true })
    }
  }

  const progressPct =
    progressTotal > 0 ? Math.min(100, Math.round((progressCompleted / progressTotal) * 100)) : 0

  const { data: rewardsRow } = await supabase
    .from('client_rewards')
    .select('total_xp, level, current_streak_days, assignments_completed')
    .eq('client_id', client.id)
    .eq('workspace_id', client.workspace_id)
    .maybeSingle()

  const { count: pendingHwCount } = await supabase
    .from('client_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .in('status', ['pending', 'returned'])

  const totalXp = rewardsRow?.total_xp ?? 0
  const levelInfo = getLevelFromXp(totalXp)
  const xpBarPct = getProgressPercent(totalXp)
  const xpToNext = getXpToNextLevel(totalXp)
  const nextLevelDef = LEVELS.find((l) => l.level === levelInfo.level + 1)
  const streak = rewardsRow?.current_streak_days ?? 0
  const doneHw = rewardsRow?.assignments_completed ?? 0

  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-4 lg:h-[calc(100dvh-var(--nav-height))] lg:max-h-[calc(100dvh-var(--nav-height))] lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-5">
      <section className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[linear-gradient(135deg,var(--accent-light),transparent)] px-5 py-5">
        <div className="flex flex-wrap items-start gap-4">
          {branding?.logoUrl?.trim() ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logoUrl.trim()} alt="" className="size-full object-contain p-1" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text-primary)]">
              {portalGreeting(hour)}, {firstName}{' '}
              <span aria-hidden>👋</span>
            </h1>
            {branding?.clientPortalHeading?.trim() ? (
              <p className="mt-2 text-[17px] font-medium leading-snug text-[var(--text-primary)]">
                {branding.clientPortalHeading.trim()}
              </p>
            ) : null}
            {branding?.brandTagline?.trim() ? (
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                {branding.brandTagline.trim()}
              </p>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-tertiary)]">
                You&apos;re doing great this week.
              </p>
            )}
            {branding?.clientWelcomeMessage?.trim() ? (
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {branding.clientWelcomeMessage.trim()}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {pendingInvoicesCount != null && pendingInvoicesCount > 0 && (
        <Card
          variant="flat"
          padding="lg"
          className="shrink-0 border border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/25"
        >
          <p className="text-[14px] font-medium text-[var(--text-primary)]">
            You have {pendingInvoicesCount} pending invoice{pendingInvoicesCount !== 1 ? 's' : ''}
          </p>
          <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
            Total due:{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: pendingCurrency.toUpperCase() === 'USD' ? 'USD' : pendingCurrency,
            }).format(pendingInvoicesTotalCents / 100)}
          </p>
          <Link
            href="/client/invoices"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[14px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            View and pay
          </Link>
        </Card>
      )}

      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
        <Card variant="flat" padding="lg" className="flex min-h-[160px] flex-col">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            My program
          </h2>
          {activeAssignment && progressTitle ? (
            <>
              <p className="mt-2 text-[16px] font-semibold text-[var(--text-primary)]">{progressTitle}</p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
                {progressCompleted} of {progressTotal} modules complete
              </p>
              <div className="min-h-2 flex-1" aria-hidden />
              <Link
                href={`/client/programs/${activeAssignment.program_id}`}
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[15px] font-medium text-[var(--text-on-accent)] shadow-[var(--shadow-xs)] transition-all duration-[var(--duration-normal)]',
                  'hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)] active:translate-y-0'
                )}
              >
                Continue
              </Link>
            </>
          ) : (
            <p className="mt-2 flex-1 text-[14px] text-[var(--text-tertiary)]">No program assigned yet.</p>
          )}
        </Card>

        <Card variant="flat" padding="lg" className="flex min-h-[160px] flex-col">
          <h2 className="text-[13px] font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)]">
            Next session
          </h2>
          {nextSession ? (
            <>
              <p className="mt-3 text-[20px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                {format(parseISO(nextSession.scheduled_time), 'EEE, MMM d')}
              </p>
              <p className="text-[17px] font-semibold text-[var(--text-primary)]">
                {format(parseISO(nextSession.scheduled_time), 'h:mm a')}
              </p>
              <span className="badge-interactive mt-2 inline-flex w-fit rounded-full bg-[var(--accent-light)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                {sessionTypeBadge(nextSession.session_type)}
              </span>
              <Link href="/client/sessions" className="link-nav mt-auto pt-4 text-[13px] font-medium">
                Add to calendar
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-[14px] text-[var(--text-tertiary)]">No upcoming sessions.</p>
              <p className="mt-1 text-[13px] text-[var(--text-quaternary)]">Message your coach to book time.</p>
              <Link href="/client/messages" className="link-nav mt-auto pt-4 text-[13px] font-medium">
                Contact coach
              </Link>
            </>
          )}
        </Card>

        <Card variant="flat" padding="lg" className="flex min-h-[160px] flex-col">
          <h2 className="text-[13px] font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)]">
            Messages
          </h2>
          <div className="mt-3 flex items-start gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] ring-offset-2 ring-offset-[var(--bg-app)] transition-shadow duration-150 hover:ring-2 hover:ring-[var(--accent)]">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-xs font-semibold text-[var(--accent)]">
                  {coachLabel.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{coachLabel}</p>
              {(messageUnreadCount ?? 0) > 0 ? (
                <span className="badge-interactive mt-1 inline-flex rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-on-accent)]">
                  {messageUnreadCount} unread
                </span>
              ) : null}
              {lastMessage ? (
                <p className="mt-2 line-clamp-2 text-[13px] text-[var(--text-tertiary)]">
                  {messagePreview(lastMessage.content, lastMessage.message_type)}
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">No messages yet.</p>
              )}
            </div>
          </div>
          <div className="min-h-2 flex-1" aria-hidden />
          <Link
            href="/client/messages"
            className={cn(
              'inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-strong)] bg-[var(--bg-app)] text-[14px] font-medium text-[var(--text-primary)] transition-all duration-150',
              'hover:border-[var(--accent-muted)] hover:bg-[var(--bg-subtle)]'
            )}
          >
            Open messages
          </Link>
        </Card>

        <Card variant="flat" padding="lg" className="flex min-h-[160px] flex-col">
          <h2 className="text-[13px] font-semibold uppercase tracking-[var(--tracking-caps)] text-[var(--text-tertiary)]">
            Rewards
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--text-on-accent)]">
              {levelInfo.level}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                Level {levelInfo.level}: {levelInfo.name}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
                  style={{ width: `${xpBarPct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                {totalXp} XP
                {nextLevelDef && xpToNext > 0
                  ? ` · ${xpToNext} XP to Level ${nextLevelDef.level}`
                  : !nextLevelDef
                    ? ' · Max level'
                    : ''}
                {` · Program ${progressPct}% complete`}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
            Streak {streak}d · {doneHw} assignments done
          </p>
          {(pendingHwCount ?? 0) > 0 ? (
            <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
              {pendingHwCount} assignment{pendingHwCount !== 1 ? 's' : ''} due
            </p>
          ) : null}
          <p className="mt-2 text-[12px] text-[var(--text-quaternary)]">
            {lastActivityLabel ? `Last activity ${lastActivityLabel}` : 'Complete a module to see activity here.'}
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-3">
            <Link href="/client/assignments" className="link-nav text-[13px] font-medium">
              View assignments
            </Link>
            <Link href="/client/programs" className="link-nav text-[13px] font-medium">
              View programs
            </Link>
          </div>
        </Card>
      </div>

      <section className="flex min-h-0 flex-1 flex-col lg:min-h-[200px]">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold tracking-[var(--tracking-heading)] text-[var(--text-primary)]">
            This week
          </h2>
          <div className="flex items-center gap-2">
            <RequestSessionButton />
            <Link href="/client/sessions" className="link-nav text-[12px] font-medium">
              View all sessions
            </Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] p-3">
          <ClientWeekCalendar clientId={client.id} />
        </div>
      </section>
    </main>
  )
}
