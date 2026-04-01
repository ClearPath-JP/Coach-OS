import type { SupabaseClient } from '@supabase/supabase-js'

function startOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function startOfPrevMonthIso(): string {
  const d = new Date()
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return prev.toISOString().slice(0, 10)
}

function endOfPrevMonthIso(): string {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth(), 0)
  return last.toISOString().slice(0, 10)
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

export type AdminOverviewClientRow = {
  id: string
  workspaceId: string
  displayName: string
  email: string | null
  status: string
  sessionsCount: number
  programName: string | null
  joinedAt: string
  lastActiveAt: string | null
}

export type AdminOverviewActivityEvent = {
  id: string
  action: string
  workspaceId: string | null
  workspaceName: string | null
  createdAt: string
  actorName: string | null
  actorEmail: string | null
  ip: string | null
  metadata: Record<string, unknown>
}

export type AdminAttentionItem =
  | { type: 'past_due'; workspaceId: string; workspaceName: string; coachEmail: string }
  | {
      type: 'inactive_coach'
      workspaceId: string
      workspaceName: string
      coachEmail: string
      daysInactive: number
    }
  | { type: 'failed_logins'; label: string; count: number }

export type AdminOverviewPayload = {
  totals: {
    coaches: number
    clients: number
    monthlyRevenueCents: number
    paymentsThisMonthCount: number
    newWorkspacesThisMonth: number
    coachesTrendPct: number | null
    activeClientsThisWeek: number
    clientsTrendPct: number | null
  }
  /** @deprecated prefer attentionItems */
  needsAttention: Array<{
    workspaceId: string
    workspaceName: string
    coachEmail: string
    issues: string[]
  }>
  attentionItems: AdminAttentionItem[]
  recentSignups: Array<{
    workspaceId: string
    workspaceName: string
    email: string
    plan: string
    joined: string
  }>
  recentPayments: Array<{
    workspaceId: string
    workspaceName: string
    amountCents: number
    method: string
    paymentDate: string
  }>
  paymentsWeekTotalCents: number
  health: {
    database: 'ok' | 'error'
    auth: 'ok' | 'error'
    storage: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
  platformHealthOk: boolean
  healthCheckedAt: string
  workspaces: Array<{
    workspaceId: string
    workspaceName: string
    coachEmail: string
    coachName: string
    coachUserId: string | null
    plan: string
    status: string
    statusLabel: 'Active' | 'Trial' | 'Paused'
    clientsCount: number
    lastActive: string | null
    revenueThisMonthCents: number
    storageUsedBytes: number
    maxVideoStorageGb: number
  }>
  clientsByWorkspace: Record<string, AdminOverviewClientRow[]>
  recentActivity: AdminOverviewActivityEvent[]
}

async function checkRedisQuick(): Promise<'ok' | 'error'> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return 'error'
    const res = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

const PROFILE_IN_CHUNK = 120

async function fetchProfilesForCoachUserIds(
  service: SupabaseClient,
  userIds: string[]
): Promise<Map<string, { id: string; email: string | null; full_name: string | null; updated_at: string | null }>> {
  const map = new Map<
    string,
    { id: string; email: string | null; full_name: string | null; updated_at: string | null }
  >()
  const unique = [...new Set(userIds)].filter(Boolean)
  for (let i = 0; i < unique.length; i += PROFILE_IN_CHUNK) {
    const chunk = unique.slice(i, i + PROFILE_IN_CHUNK)
    const { data, error } = await service
      .from('profiles')
      .select('id,email,full_name,updated_at')
      .in('id', chunk)
    if (error) continue
    for (const p of data ?? []) {
      map.set(p.id, p)
    }
  }
  return map
}

function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) {
    if (current <= 0) return null
    return 100
  }
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Admin overview: avoid full-table scans on `profiles` and minimize client payload.
 */
export async function fetchAdminOverviewPayload(service: SupabaseClient): Promise<AdminOverviewPayload> {
  const monthStart = startOfMonthIso()
  const prevMonthStart = startOfPrevMonthIso()
  const prevMonthEnd = endOfPrevMonthIso()
  const weekAgo = daysAgoIso(7)
  const twoWeeksAgo = daysAgoIso(14)
  const sevenAgoDate = daysAgoIso(7)
  const healthCheckedAt = new Date().toISOString()
  const utcNow = new Date()
  const utcDayStart = new Date(
    Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate())
  ).toISOString()

  const [
    coachCountRes,
    clientCountRes,
    revenueRes,
    paymentsMonthCountRes,
    workspacesRes,
    newWsThisMonthRes,
    newWsPrevMonthRes,
    coachesRes,
    subsRes,
    clientsWorkspaceOnlyRes,
    allClientsRes,
    sessionsForCountsRes,
    clientProgramsRes,
    paymentsRecentRes,
    paymentsWeekRes,
    paymentsMonthByWsRes,
    activeClientsWeekRes,
    activeClientsPrevWeekRes,
    auditRecentRes,
    auditFailedTodayRes,
    dbPing,
    buckets,
    authList,
    redis,
  ] = await Promise.all([
    service.from('coaches').select('id', { count: 'exact', head: true }),
    service.from('clients').select('id', { count: 'exact', head: true }),
    service.from('payments').select('amount_cents').gte('payment_date', monthStart),
    service.from('payments').select('id', { count: 'exact', head: true }).gte('payment_date', monthStart),
    service
      .from('workspaces')
      .select('id,name,created_at,status,max_clients,storage_used_bytes,max_video_storage_gb'),
    service.from('workspaces').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    service
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', prevMonthStart)
      .lte('created_at', `${prevMonthEnd}T23:59:59.999Z`),
    service.from('coaches').select('workspace_id,user_id,created_at'),
    service.from('subscriptions').select('workspace_id,plan,status,trial_ends_at'),
    service.from('clients').select('workspace_id,updated_at'),
    service
      .from('clients')
      .select('id,workspace_id,first_name,last_name,email,status,created_at,updated_at')
      .order('created_at', { ascending: false }),
    service.from('sessions').select('client_id,workspace_id'),
    service.from('client_programs').select('client_id,program_id,workspace_id'),
    service
      .from('payments')
      .select('workspace_id,amount_cents,payment_method,payment_date')
      .order('payment_date', { ascending: false })
      .limit(5),
    service.from('payments').select('amount_cents').gte('payment_date', weekAgo.slice(0, 10)),
    service.from('payments').select('workspace_id,amount_cents').gte('payment_date', monthStart),
    service.from('clients').select('id', { count: 'exact', head: true }).gte('updated_at', weekAgo),
    service
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', twoWeeksAgo)
      .lt('updated_at', weekAgo),
    service
      .from('audit_logs')
      .select('id,action,user_id,workspace_id,ip_address,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('audit_logs')
      .select('action,metadata,ip_address,created_at')
      .eq('action', 'login_failed')
      .gte('created_at', utcDayStart),
    service.from('workspaces').select('id').limit(1),
    service.storage.listBuckets(),
    service.auth.admin.listUsers({ page: 1, perPage: 1 }),
    checkRedisQuick(),
  ])

  const programIds = [...new Set((clientProgramsRes.data ?? []).map((r) => r.program_id).filter(Boolean))] as string[]
  const { data: programRows } =
    programIds.length > 0
      ? await service.from('programs').select('id,name').in('id', programIds)
      : { data: [] as { id: string; name: string }[] }
  const programNameById = new Map((programRows ?? []).map((p) => [p.id, p.name ?? 'Program']))

  const coachRows = coachesRes.data ?? []
  const coachUserIds = coachRows.map((c) => c.user_id).filter(Boolean) as string[]
  const profilesById = await fetchProfilesForCoachUserIds(service, coachUserIds)

  const coachByWorkspace = new Map<string, (typeof coachRows)[0]>()
  for (const c of coachRows) {
    coachByWorkspace.set(c.workspace_id, c)
  }

  const subsByWorkspace = new Map((subsRes.data ?? []).map((s) => [s.workspace_id, s]))
  const clientCountByWorkspace = new Map<string, number>()
  for (const c of clientsWorkspaceOnlyRes.data ?? []) {
    const wid = c.workspace_id as string
    clientCountByWorkspace.set(wid, (clientCountByWorkspace.get(wid) ?? 0) + 1)
  }

  const sessionsCountByClientId = new Map<string, number>()
  for (const row of sessionsForCountsRes.data ?? []) {
    const cid = row.client_id
    if (!cid) continue
    const key = String(cid)
    sessionsCountByClientId.set(key, (sessionsCountByClientId.get(key) ?? 0) + 1)
  }

  const programByClientId = new Map<string, string>()
  for (const cp of clientProgramsRes.data ?? []) {
    const cid = String(cp.client_id)
    if (programByClientId.has(cid)) continue
    const name = programNameById.get(cp.program_id as string)
    if (name) programByClientId.set(cid, name)
  }

  const revenueByWorkspace = new Map<string, number>()
  for (const p of paymentsMonthByWsRes.data ?? []) {
    const wid = p.workspace_id as string
    revenueByWorkspace.set(wid, (revenueByWorkspace.get(wid) ?? 0) + (p.amount_cents ?? 0))
  }

  const clientsByWorkspace: Record<string, AdminOverviewClientRow[]> = {}
  for (const cl of allClientsRes.data ?? []) {
    const wid = cl.workspace_id as string
    const displayName =
      `${cl.first_name ?? ''} ${cl.last_name ?? ''}`.trim() || (cl.email as string) || 'Client'
    const row: AdminOverviewClientRow = {
      id: cl.id as string,
      workspaceId: wid,
      displayName,
      email: (cl.email as string | null) ?? null,
      status: (cl.status as string) ?? 'active',
      sessionsCount: sessionsCountByClientId.get(String(cl.id)) ?? 0,
      programName: programByClientId.get(String(cl.id)) ?? null,
      joinedAt: cl.created_at as string,
      lastActiveAt: (cl.updated_at as string | null) ?? null,
    }
    if (!clientsByWorkspace[wid]) clientsByWorkspace[wid] = []
    clientsByWorkspace[wid].push(row)
  }

  const workspaceRows = workspacesRes.data ?? []
  const newThisMonth = newWsThisMonthRes.count ?? 0
  const newPrevMonth = newWsPrevMonthRes.count ?? 0
  const coachesTrendPct = trendPct(newThisMonth, newPrevMonth)

  const activeWeek = activeClientsWeekRes.count ?? 0
  const activePrev = activeClientsPrevWeekRes.count ?? 0
  const clientsTrendPct = trendPct(activeWeek, activePrev)

  const monthlyRevenueCents = (revenueRes.data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const paymentsWeekTotalCents = (paymentsWeekRes.data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0)

  const needsAttention: AdminOverviewPayload['needsAttention'] = []
  const attentionItems: AdminAttentionItem[] = []
  const recentSignups: AdminOverviewPayload['recentSignups'] = []

  const sortedWs = [...workspaceRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  for (const w of sortedWs.slice(0, 5)) {
    const coach = coachByWorkspace.get(w.id)
    const profile = coach ? profilesById.get(coach.user_id) : undefined
    const sub = subsByWorkspace.get(w.id)
    recentSignups.push({
      workspaceId: w.id,
      workspaceName: w.name ?? 'Workspace',
      email: profile?.email ?? '—',
      plan: sub?.plan ?? 'free',
      joined: w.created_at,
    })
  }

  const workspacesPayload: AdminOverviewPayload['workspaces'] = []

  for (const w of workspaceRows) {
    const coach = coachByWorkspace.get(w.id)
    const profile = coach ? profilesById.get(coach.user_id) : undefined
    const sub = subsByWorkspace.get(w.id)
    const clientsCount = clientCountByWorkspace.get(w.id) ?? 0
    const plan = sub?.plan ?? 'free'
    const issues: string[] = []
    if (sub?.status === 'past_due') {
      issues.push('Subscription past due')
      attentionItems.push({
        type: 'past_due',
        workspaceId: w.id,
        workspaceName: w.name ?? 'Workspace',
        coachEmail: profile?.email ?? '',
      })
    }
    if (clientsCount === 0 && new Date(w.created_at).getTime() < new Date(sevenAgoDate).getTime()) {
      issues.push('No clients after 7 days')
    }
    const lastActive = profile?.updated_at ?? null
    if (lastActive && lastActive < twoWeeksAgo) {
      const daysInactive = Math.floor(
        (Date.now() - new Date(lastActive).getTime()) / 86400000
      )
      issues.push('No coach activity in 14+ days')
      attentionItems.push({
        type: 'inactive_coach',
        workspaceId: w.id,
        workspaceName: w.name ?? 'Workspace',
        coachEmail: profile?.email ?? '',
        daysInactive,
      })
    }
    if (issues.length) {
      needsAttention.push({
        workspaceId: w.id,
        workspaceName: w.name ?? 'Workspace',
        coachEmail: profile?.email ?? '—',
        issues,
      })
    }
    const wRow = w as {
      storage_used_bytes?: number
      max_video_storage_gb?: number
    }
    const workspaceStatus = (w as { status?: string }).status ?? 'active'
    const subStatus = sub?.status ?? 'active'
    const inTrial =
      subStatus === 'trialing' || (sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date())
    let statusLabel: 'Active' | 'Trial' | 'Paused' = 'Active'
    if (workspaceStatus === 'suspended') statusLabel = 'Paused'
    else if (inTrial) statusLabel = 'Trial'

    workspacesPayload.push({
      workspaceId: w.id,
      workspaceName: w.name ?? 'Untitled workspace',
      coachEmail: profile?.email ?? '—',
      coachName: profile?.full_name ?? 'Coach',
      coachUserId: coach?.user_id ?? null,
      plan,
      status: subStatus,
      statusLabel,
      clientsCount,
      lastActive,
      revenueThisMonthCents: revenueByWorkspace.get(w.id) ?? 0,
      storageUsedBytes: Number(wRow.storage_used_bytes ?? 0),
      maxVideoStorageGb: Number(wRow.max_video_storage_gb ?? 5),
    })
  }

  const failedToday = auditFailedTodayRes.data ?? []
  const failBuckets = new Map<string, number>()
  for (const row of failedToday) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    const key =
      (typeof meta.email === 'string' && meta.email) ||
      (row.ip_address as string | null) ||
      'unknown'
    failBuckets.set(key, (failBuckets.get(key) ?? 0) + 1)
  }
  for (const [label, count] of failBuckets) {
    if (count >= 3) {
      attentionItems.push({ type: 'failed_logins', label, count })
    }
  }

  const activityUserIds = [
    ...new Set((auditRecentRes.data ?? []).map((l) => l.user_id).filter(Boolean)),
  ] as string[]
  const activityProfiles =
    activityUserIds.length > 0
      ? await service.from('profiles').select('id,email,full_name').in('id', activityUserIds)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] }
  const actProfileById = new Map((activityProfiles.data ?? []).map((p) => [p.id, p]))
  const actWsIds = [...new Set((auditRecentRes.data ?? []).map((l) => l.workspace_id).filter(Boolean))] as string[]
  const actWorkspaces =
    actWsIds.length > 0
      ? await service.from('workspaces').select('id,name').in('id', actWsIds)
      : { data: [] as { id: string; name: string | null }[] }
  const actWsName = new Map((actWorkspaces.data ?? []).map((w) => [w.id, w.name ?? 'Workspace']))

  const recentActivity: AdminOverviewActivityEvent[] = (auditRecentRes.data ?? []).map((l) => {
    const prof = l.user_id ? actProfileById.get(l.user_id) : undefined
    return {
      id: l.id as string,
      action: l.action as string,
      workspaceId: (l.workspace_id as string | null) ?? null,
      workspaceName: l.workspace_id ? actWsName.get(l.workspace_id as string) ?? null : null,
      createdAt: l.created_at as string,
      actorName: prof?.full_name ?? null,
      actorEmail: prof?.email ?? null,
      ip: (l.ip_address as string | null) ?? null,
      metadata: (l.metadata as Record<string, unknown>) ?? {},
    }
  })

  const wsNameById = new Map(workspaceRows.map((w) => [w.id, w.name ?? 'Workspace']))
  const recentPayments = (paymentsRecentRes.data ?? []).map((p) => ({
    workspaceId: p.workspace_id,
    workspaceName: wsNameById.get(p.workspace_id) ?? '—',
    amountCents: p.amount_cents ?? 0,
    method: p.payment_method ?? '—',
    paymentDate: p.payment_date ?? '',
  }))

  const healthDb = dbPing.error ? ('error' as const) : ('ok' as const)
  const healthAuth = authList.error ? ('error' as const) : ('ok' as const)
  const healthStorage = buckets.error ? ('error' as const) : ('ok' as const)
  const healthRedis = redis
  const platformHealthOk = healthDb === 'ok' && healthAuth === 'ok' && healthStorage === 'ok' && healthRedis === 'ok'

  return {
    totals: {
      coaches: coachCountRes.count ?? 0,
      clients: clientCountRes.count ?? 0,
      monthlyRevenueCents,
      paymentsThisMonthCount: paymentsMonthCountRes.count ?? 0,
      newWorkspacesThisMonth: newThisMonth,
      coachesTrendPct,
      activeClientsThisWeek: activeWeek,
      clientsTrendPct,
    },
    needsAttention,
    attentionItems,
    recentSignups,
    recentPayments,
    paymentsWeekTotalCents,
    health: {
      database: healthDb,
      auth: healthAuth,
      storage: healthStorage,
      redis: healthRedis,
    },
    platformHealthOk,
    healthCheckedAt,
    workspaces: workspacesPayload,
    clientsByWorkspace,
    recentActivity,
  }
}
