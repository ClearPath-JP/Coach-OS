import { createServiceClient } from '@/lib/supabase/service'

/** Per-plan caps: clients, storage pools, assignment count per client. */
export const PLAN_LIMITS = {
  free: {
    maxClients: 3,
    maxVideoStorageGb: 1,
    maxAssignmentStorageGb: 0.5,
    maxAssignmentsPerClient: 5,
  },
  founding: {
    maxClients: null as number | null, // unlimited — same as pro
    maxVideoStorageGb: 50,
    maxAssignmentStorageGb: 20,
    maxAssignmentsPerClient: 999,
  },
  starter: {
    maxClients: 15,
    maxVideoStorageGb: 10,
    maxAssignmentStorageGb: 5,
    maxAssignmentsPerClient: 50,
  },
  pro: {
    maxClients: null as number | null, // unlimited
    maxVideoStorageGb: 50,
    maxAssignmentStorageGb: 20,
    maxAssignmentsPerClient: 999,
  },
  scale: {
    maxClients: null as number | null, // unlimited
    maxVideoStorageGb: 200,
    maxAssignmentStorageGb: 100,
    maxAssignmentsPerClient: 999,
  },
} as const

export type StorageKind = 'video' | 'assignment_file'

/** Default client caps by plan when workspace.max_clients is unset. */
export const DEFAULT_MAX_CLIENTS_BY_PLAN = {
  free: PLAN_LIMITS.free.maxClients,
  founding: 999999, // unlimited
  starter: PLAN_LIMITS.starter.maxClients,
  pro: 999999,  // unlimited
  scale: 999999, // unlimited
} as const

export function effectiveClientLimit(plan: string, workspaceMaxClients: number | null | undefined): number {
  if (plan === 'founding' || plan === 'pro' || plan === 'scale') {
    // Both pro and scale are unlimited — workspace override still respected for admin overrides
    return workspaceMaxClients != null && workspaceMaxClients > 0
      ? workspaceMaxClients
      : DEFAULT_MAX_CLIENTS_BY_PLAN[plan as keyof typeof DEFAULT_MAX_CLIENTS_BY_PLAN]
  }
  if (workspaceMaxClients != null && workspaceMaxClients > 0) return workspaceMaxClients
  const fallback = DEFAULT_MAX_CLIENTS_BY_PLAN[plan as keyof typeof DEFAULT_MAX_CLIENTS_BY_PLAN]
  return fallback ?? DEFAULT_MAX_CLIENTS_BY_PLAN.free
}

/** Implied monthly SaaS MRR per plan for admin rollups — keep aligned with Stripe Prices + SubscriptionPageContent. */
export const PLAN_MRR_CENTS: Record<string, number> = {
  free: 0,
  founding: 9900,
  starter: 9900,
  pro: 14900,
  scale: 24900,
}

/**
 * Enforces plan client caps when adding clients. Scale is treated as unlimited (max null).
 */
export async function checkClientLimit(
  workspaceId: string
): Promise<{ allowed: boolean; max: number | null }> {
  const service = createServiceClient()
  const { data: sub } = await service
    .from('subscriptions')
    .select('plan')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const plan = sub?.plan ?? 'free'

  if (plan === 'founding' || plan === 'pro' || plan === 'scale') {
    return { allowed: true, max: null }
  }

  const { data: ws } = await service.from('workspaces').select('max_clients').eq('id', workspaceId).maybeSingle()
  const max = effectiveClientLimit(plan, ws?.max_clients)

  const { count, error } = await service
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (error) {
    return { allowed: false, max }
  }
  const current = count ?? 0
  return { allowed: current < max, max }
}

function planLimitsFor(plan: string) {
  const p = plan as keyof typeof PLAN_LIMITS
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.free
}

/**
 * Enforces per-pool storage: videos vs assignment submission files (bytes on assignment_submissions).
 */
export async function checkStorageLimit(
  workspaceId: string,
  newFileSizeBytes: number,
  kind: StorageKind = 'video'
): Promise<{ allowed: boolean; usedGb: number; maxGb: number }> {
  const service = createServiceClient()
  const { data: sub } = await service
    .from('subscriptions')
    .select('plan')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const plan = sub?.plan ?? 'free'
  const limits = planLimitsFor(plan)

  const maxGb =
    kind === 'video' ? limits.maxVideoStorageGb : limits.maxAssignmentStorageGb
  const maxBytes = maxGb * 1_000_000_000

  if (kind === 'video') {
    const { data: rows } = await service
      .from('videos')
      .select('file_size_bytes')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    const used = (rows ?? []).reduce((s, v) => s + (v.file_size_bytes ?? 0), 0)
    const usedGb = used / 1_000_000_000
    return {
      allowed: used + newFileSizeBytes <= maxBytes,
      usedGb,
      maxGb,
    }
  }

  const { data: rows } = await service
    .from('assignment_submissions')
    .select('file_size_bytes')
    .eq('workspace_id', workspaceId)
  const used = (rows ?? []).reduce((s, v) => s + (v.file_size_bytes ?? 0), 0)
  const usedGb = used / 1_000_000_000
  return {
    allowed: used + newFileSizeBytes <= maxBytes,
    usedGb,
    maxGb,
  }
}

export async function checkAssignmentsPerClientLimit(
  workspaceId: string,
  clientId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const service = createServiceClient()
  const { data: sub } = await service
    .from('subscriptions')
    .select('plan')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const plan = sub?.plan ?? 'free'
  const max = planLimitsFor(plan).maxAssignmentsPerClient

  const { count, error } = await service
    .from('client_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
  if (error) {
    return { allowed: false, current: 0, max }
  }
  const current = count ?? 0
  return { allowed: current < max, current, max }
}
