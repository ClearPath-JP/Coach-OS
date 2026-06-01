import { createServiceClient } from '@/lib/supabase/service'

/**
 * Per-plan entitlements: clients, storage pools, monthly streaming, assignments,
 * monthly Local Scout (lead) searches, and feature flags.
 * Canonical source — landing PricingSection + /coach/subscription read from here.
 * Local Scout is gated to Pro+ (searches: 0 + localScout: false on free/starter).
 * Streaming caps are catalog/display truth; hard enforcement lands with the Cloudflare Stream work.
 */
export const PLAN_LIMITS = {
  free: {
    // Trial mirrors Starter so what they see in the trial = what they'll get.
    maxClients: 15,
    maxVideoStorageGb: 5,
    maxStreamingGb: 25,
    maxAssignmentStorageGb: 2,
    maxAssignmentsPerClient: 50,
    maxLeadSearchesPerMonth: 0, // Local Scout is Pro+ only
    localScout: false,
  },
  founding: {
    // $99/mo-for-life early bird = Pro access, with grandfathered 50 GB storage.
    maxClients: null as number | null, // unlimited — same as pro
    maxVideoStorageGb: 50,
    maxStreamingGb: 100,
    maxAssignmentStorageGb: 20,
    maxAssignmentsPerClient: 999,
    maxLeadSearchesPerMonth: 50,
    localScout: true,
  },
  starter: {
    maxClients: 15,
    maxVideoStorageGb: 5,
    maxStreamingGb: 25,
    maxAssignmentStorageGb: 5,
    maxAssignmentsPerClient: 50,
    maxLeadSearchesPerMonth: 0, // Local Scout is a Pro+ upgrade driver
    localScout: false,
  },
  pro: {
    maxClients: null as number | null, // unlimited
    maxVideoStorageGb: 25,
    maxStreamingGb: 100,
    maxAssignmentStorageGb: 20,
    maxAssignmentsPerClient: 999,
    maxLeadSearchesPerMonth: 50,
    localScout: true,
  },
  scale: {
    maxClients: null as number | null, // unlimited
    maxVideoStorageGb: 100,
    maxStreamingGb: 500,
    maxAssignmentStorageGb: 100,
    maxAssignmentsPerClient: 999,
    maxLeadSearchesPerMonth: 200,
    localScout: true,
  },
} as const

export type StorageKind = 'video' | 'assignment_file'

/** Default client caps by plan when workspace.max_clients is unset. */
export const DEFAULT_MAX_CLIENTS_BY_PLAN = {
  free: 15,
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
  founding: 9900, // early-bird: $99/mo for life
  starter: 7900, // $79/mo
  pro: 14900, // $149/mo
  scale: 29900, // $299/mo
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

/**
 * Returns the coach's monthly lead-search usage + limit for the current calendar month.
 * Used by /api/coach/leads/search to enforce caps before calling Claude API.
 */
export async function checkLeadSearchLimit(
  workspaceId: string
): Promise<{ allowed: boolean; used: number; max: number }> {
  const service = createServiceClient()
  const { data: sub } = await service
    .from('subscriptions')
    .select('plan')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const plan = sub?.plan ?? 'free'
  const max = planLimitsFor(plan).maxLeadSearchesPerMonth

  // Free is a one-time trial counted for all time; paid plans reset each calendar month.
  const isLifetime = plan === 'free'
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // Only completed searches consume the quota — a failed or empty search
  // (no usable results) must not cost the coach a credit.
  let query = service
    .from('lead_searches')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'done')
  if (!isLifetime) {
    query = query.gte('created_at', monthStart.toISOString())
  }
  const { count, error } = await query
  if (error) {
    return { allowed: false, used: 0, max }
  }
  const used = count ?? 0
  return { allowed: used < max, used, max }
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
