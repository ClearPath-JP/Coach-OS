import { addDays, formatDistanceToNow, parseISO } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'

export type ClientPortalTodayCheckin = {
  checkin: {
    id: string
    moodScore: number
    energyScore: number | null
    note: string | null
    checkinDate: string
    createdAt: string
  } | null
  streakDays: number
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Single-load payload for the client portal (server-only). Used by GET /api/client/portal-data.
 */
export async function loadClientPortalBundle(
  supabase: SupabaseClient,
  opts: {
    clientId: string
    workspaceId: string
    coachId: string
    userId: string
    userEmail: string | undefined
  }
): Promise<{
  coachDisplayName: string
  branding: Awaited<ReturnType<typeof getClientWorkspaceBranding>>
  nextSession: Record<string, unknown> | null
  pendingInvoices: unknown[]
  rewards: Record<string, unknown> | null
  assignmentRows: unknown[]
  goalRows: unknown[]
  lastMessage: Record<string, unknown> | null
  messageUnreadCount: number
  coachProfile: { display_name: string | null; full_name: string | null } | null
  programBlock: {
    title: string
    programId: string
    completed: number
    total: number
    lastActivity: string | null
  } | null
  todayCheckin: ClientPortalTodayCheckin
}> {
  const { clientId, workspaceId, coachId, userId, userEmail } = opts
  const now = new Date()
  const nowIso = now.toISOString()
  const thirtyDaysIso = addDays(now, 30).toISOString()
  const today = utcToday()

  const [
    branding,
    nextSessionRes,
    pendingInvoiceRes,
    rewardsRes,
    assignmentsRes,
    goalsRes,
    lastMsgRes,
    unreadRes,
    coachRes,
    activeProgramRes,
    checkinRes,
  ] = await Promise.all([
    getClientWorkspaceBranding(userEmail),
    supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status, session_type, notes')
      .eq('client_id', clientId)
      .gte('scheduled_time', nowIso)
      .lte('scheduled_time', thirtyDaysIso)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('session_invoices')
      .select('id, amount_cents, currency, status, created_at, session_packages(title, description)')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('client_rewards')
      .select('total_xp, level, current_streak_days, assignments_completed')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('client_assignments')
      .select('id, status, due_at, points_awarded, assignment_templates(title, assignment_type, points)')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'returned'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('client_goals')
      .select(
        'id, title, status, category, target_value, start_value, current_value, unit, achieved_at'
      )
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('messages')
      .select('content, message_type, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null),
    supabase.from('profiles').select('display_name, full_name').eq('id', coachId).maybeSingle(),
    supabase
      .from('client_programs')
      .select('id, program_id, status, updated_at')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('daily_checkins')
      .select('id, mood_score, energy_score, note, checkin_date, created_at')
      .eq('client_id', clientId)
      .eq('checkin_date', today)
      .maybeSingle(),
  ])

  const nextSession = nextSessionRes.error ? null : (nextSessionRes.data as Record<string, unknown> | null)
  const pendingInvoices = pendingInvoiceRes.error ? [] : (pendingInvoiceRes.data ?? [])
  const rewardsRow = rewardsRes.error ? null : rewardsRes.data
  const assignmentRows = assignmentsRes.error ? [] : (assignmentsRes.data ?? [])
  const goalRows = goalsRes.error ? [] : (goalsRes.data ?? [])
  const lastMessage = lastMsgRes.error ? null : (lastMsgRes.data as Record<string, unknown> | null)
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
      const [{ data: progressRows }, { data: lastDone }] = await Promise.all([
        supabase.from('program_progress').select('completed_at').eq('client_program_id', cp.id),
        supabase
          .from('program_progress')
          .select('completed_at')
          .eq('client_program_id', cp.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const completed = (progressRows ?? []).filter((r) => r.completed_at != null).length
      const total = programRow.total_modules ?? 0
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

  const rw = rewardsRow as { current_streak_days?: number } | null
  const streakDays = rw?.current_streak_days ?? 0
  const checkin = checkinRes.data
  const todayCheckin: ClientPortalTodayCheckin = {
    checkin: checkin
      ? {
          id: checkin.id,
          moodScore: checkin.mood_score,
          energyScore: checkin.energy_score,
          note: checkin.note,
          checkinDate: checkin.checkin_date,
          createdAt: checkin.created_at,
        }
      : null,
    streakDays,
  }

  return {
    coachDisplayName,
    branding,
    nextSession,
    pendingInvoices,
    rewards: rewardsRow as Record<string, unknown> | null,
    assignmentRows,
    goalRows,
    lastMessage,
    messageUnreadCount,
    coachProfile,
    programBlock,
    todayCheckin,
  }
}
