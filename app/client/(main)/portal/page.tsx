import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'
import { normalizeEmail } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { ClientWeekCalendar } from '@/components/client/ClientWeekCalendar'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

function messagePreview(content: string | null, messageType: string | null): string {
  if (messageType === 'invoice') return 'Invoice from your coach'
  if (messageType === 'session') return 'Session update from your coach'
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
    .select('id, first_name, status')
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

  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-4 lg:h-[calc(100dvh-var(--nav-height))] lg:max-h-[calc(100dvh-var(--nav-height))] lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-5">
      <section className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[linear-gradient(135deg,var(--accent-light),transparent)] px-5 py-5">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text-primary)]">
          {portalGreeting(hour)}, {firstName}{' '}
          <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-tertiary)]">
          You&apos;re doing great this week.
        </p>
        {branding?.clientWelcomeMessage?.trim() ? (
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">{branding.clientWelcomeMessage}</p>
        ) : null}
      </section>

      {pendingInvoicesCount != null && pendingInvoicesCount > 0 && (
        <Card variant="flat" padding="lg" className="shrink-0 border-[var(--warning-border)]/50 bg-[var(--warning-bg)]/40">
          <p className="text-[14px] text-[var(--text-primary)]">
            You have {pendingInvoicesCount} pending invoice{pendingInvoicesCount !== 1 ? 's' : ''}.
          </p>
          <Link href="/client/invoices" className="link-nav mt-2 inline-block text-[13px] font-medium">
            View invoices
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
            My progress
          </h2>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[32px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{progressPct}%</p>
              <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Overall completion</p>
            </div>
            <div className="flex gap-2" aria-hidden>
              {[0, 1, 2].map((i) => {
                const filled = progressPct > i * 33
                return (
                  <div
                    key={i}
                    className={cn(
                      'size-9 rounded-full border-2 border-[var(--border-default)] transition-opacity duration-150',
                      filled && 'border-t-[var(--accent)]'
                    )}
                    style={{ opacity: filled ? 1 : 0.45, transform: 'rotate(45deg)' }}
                  />
                )
              })}
            </div>
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-quaternary)]">
            {lastActivityLabel ? `Last activity ${lastActivityLabel}` : 'Complete a module to see activity here.'}
          </p>
          <Link href="/client/programs" className="link-nav mt-auto pt-4 text-[13px] font-medium">
            View programs
          </Link>
        </Card>
      </div>

      <section className="flex min-h-0 flex-1 flex-col lg:min-h-[200px]">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold tracking-[var(--tracking-heading)] text-[var(--text-primary)]">
            This week
          </h2>
          <Link href="/client/sessions" className="link-nav text-[12px] font-medium">
            View all sessions
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] p-3">
          <ClientWeekCalendar clientId={client.id} />
        </div>
      </section>
    </main>
  )
}
