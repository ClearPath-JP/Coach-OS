import type { SupabaseClient } from '@supabase/supabase-js'
import { logServerError } from '@/lib/log-server-error'

/**
 * Shared new-coach activation: creates workspace + profile + coach row + subscription row
 * after a successful new-coach Stripe checkout.
 *
 * Called from BOTH:
 *  - /api/billing/new-coach-activate (browser redirect — the happy path), and
 *  - /api/webhooks/stripe `checkout.session.completed` (backstop — runs even if the
 *    buyer closed the tab on Stripe's success page and never came back).
 *
 * IDEMPOTENT + RACE-SAFE without schema changes:
 *  - Fast path: if a coaches row already exists for this user, only make sure the
 *    subscription row exists, then report already-active.
 *  - The two paths are serialized through a claim row in stripe_webhook_events
 *    (PK event_id) using a synthetic key ("new_coach_activation:<userId>") that can
 *    never collide with real Stripe event ids ("evt_..."). Whoever inserts the claim
 *    first performs the activation; the loser reports { inProgress: true } and retries
 *    later (webhook → 5xx so Stripe redelivers; redirect → brief poll for the coach row).
 *  - A claim older than CLAIM_STALE_MS belongs to a crashed attempt and is atomically
 *    stolen (conditional UPDATE on processed_at), so failures always stay retryable.
 *  - Every step is check-before-insert and tolerates unique-violation races (23505)
 *    by treating them as already-done. A workspace already owned by the user (from a
 *    crashed earlier attempt) is adopted instead of duplicated.
 */

export type WorkspacePlan = 'founding' | 'starter' | 'pro' | 'scale'

export interface NewCoachActivationInput {
  userId: string
  plan: WorkspacePlan
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: 'trialing' | 'active' | 'past_due'
  /** ISO timestamp or null */
  currentPeriodEnd: string | null
  /** ISO timestamp or null */
  trialEndsAt: string | null
}

export type NewCoachActivationResult =
  | { ok: true; workspaceId: string; alreadyActive: boolean }
  | { ok: false; reason: string; inProgress?: boolean }

const CLAIM_PREFIX = 'new_coach_activation:'
/** A claim older than this belongs to a crashed activation attempt and may be stolen. */
const CLAIM_STALE_MS = 60_000

/** Look up the user's existing coach row (oldest first), if any. */
async function findCoachWorkspace(
  service: SupabaseClient,
  userId: string
): Promise<{ workspaceId: string | null; error: string | null }> {
  const { data, error } = await service
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) return { workspaceId: null, error: error.message }
  return { workspaceId: (data?.workspace_id as string | undefined) ?? null, error: null }
}

/**
 * Insert/refresh the workspace's subscription row (UNIQUE(workspace_id)).
 * Never clobbers a row that records a DIFFERENT Stripe subscription id — that would
 * hide a possible double subscription; it is flagged for a human instead.
 * Returns an error string, or null on success.
 */
async function ensureSubscriptionRow(
  service: SupabaseClient,
  workspaceId: string,
  input: NewCoachActivationInput
): Promise<string | null> {
  if (!input.stripeSubscriptionId) return null

  const { data: existing, error: readErr } = await service
    .from('subscriptions')
    .select('id, stripe_subscription_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (readErr) return `subscription lookup failed: ${readErr.message}`

  const row = {
    workspace_id: workspaceId,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    plan: input.plan,
    status: input.subscriptionStatus,
    current_period_end: input.currentPeriodEnd,
    trial_ends_at: input.trialEndsAt,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const recordedSub = existing.stripe_subscription_id as string | null
    if (recordedSub && recordedSub !== input.stripeSubscriptionId) {
      await logServerError(
        'new-coach-activation',
        new Error(
          'workspace already has a different Stripe subscription recorded — possible duplicate coach subscription, manual review needed'
        ),
        { workspaceId, recordedSub, incomingSub: input.stripeSubscriptionId }
      )
      return null
    }
    const { error: updErr } = await service.from('subscriptions').update(row).eq('id', existing.id)
    return updErr ? `subscription update failed: ${updErr.message}` : null
  }

  const { error: insErr } = await service.from('subscriptions').insert(row)
  if (insErr) {
    if (insErr.code === '23505') return null // concurrent writer already recorded it
    return `subscription insert failed: ${insErr.message}`
  }
  return null
}

/**
 * Acquire the per-user activation claim. Exactly one concurrent caller wins.
 * Stale claims (crashed attempts) are stolen atomically: under READ COMMITTED the
 * lt() predicate is re-evaluated after any lock wait, so only one stealer can win.
 */
async function acquireClaim(
  service: SupabaseClient,
  userId: string
): Promise<{ acquired: boolean; inProgress?: boolean; error?: string }> {
  const claimKey = `${CLAIM_PREFIX}${userId}`

  const { error: insErr } = await service
    .from('stripe_webhook_events')
    .insert({ event_id: claimKey })
  if (!insErr) return { acquired: true }
  if (insErr.code !== '23505') {
    return { acquired: false, error: `activation claim insert failed: ${insErr.message}` }
  }

  // Claim exists — held by a concurrent attempt, or left behind by a crashed one.
  const { data: claim, error: readErr } = await service
    .from('stripe_webhook_events')
    .select('processed_at')
    .eq('event_id', claimKey)
    .maybeSingle()
  if (readErr) return { acquired: false, error: `activation claim read failed: ${readErr.message}` }
  if (!claim) {
    // Row vanished between conflict and read (extremely unlikely) — one more try.
    const { error: retryErr } = await service
      .from('stripe_webhook_events')
      .insert({ event_id: claimKey })
    if (!retryErr) return { acquired: true }
    return { acquired: false, inProgress: true }
  }

  const ageMs = Date.now() - new Date(claim.processed_at as string).getTime()
  if (!Number.isFinite(ageMs) || ageMs < CLAIM_STALE_MS) {
    return { acquired: false, inProgress: true }
  }

  const staleCutoffIso = new Date(Date.now() - CLAIM_STALE_MS).toISOString()
  const { data: stolen, error: stealErr } = await service
    .from('stripe_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', claimKey)
    .lt('processed_at', staleCutoffIso)
    .select('event_id')
  if (stealErr) return { acquired: false, error: `activation claim steal failed: ${stealErr.message}` }
  if (stolen && stolen.length > 0) return { acquired: true }
  return { acquired: false, inProgress: true }
}

/**
 * Activate a new coach after a paid checkout. Safe to call from both the redirect
 * route and the webhook, concurrently and repeatedly. Works with the service-role
 * client only (no browser session required).
 */
export async function activateNewCoach(
  service: SupabaseClient,
  input: NewCoachActivationInput
): Promise<NewCoachActivationResult> {
  const { userId } = input

  // 1. Fast path — already activated by either path: just make sure the
  //    subscription row exists, then report already-active.
  const fast = await findCoachWorkspace(service, userId)
  if (fast.error) return { ok: false, reason: `coach lookup failed: ${fast.error}` }
  if (fast.workspaceId) {
    const subErr = await ensureSubscriptionRow(service, fast.workspaceId, input)
    if (subErr) return { ok: false, reason: subErr }
    return { ok: true, workspaceId: fast.workspaceId, alreadyActive: true }
  }

  // 2. Serialize webhook vs redirect through the claim row.
  const claim = await acquireClaim(service, userId)
  if (!claim.acquired) {
    if (claim.error) return { ok: false, reason: claim.error }
    return { ok: false, reason: 'activation already in progress', inProgress: true }
  }

  // 3. Re-check under the claim (a previous attempt may have completed between the
  //    fast-path check and a stolen claim).
  const under = await findCoachWorkspace(service, userId)
  if (under.error) return { ok: false, reason: `coach lookup failed: ${under.error}` }
  if (under.workspaceId) {
    const subErr = await ensureSubscriptionRow(service, under.workspaceId, input)
    if (subErr) return { ok: false, reason: subErr }
    return { ok: true, workspaceId: under.workspaceId, alreadyActive: true }
  }

  // 4. User details via the admin API — works with no browser session (webhook path).
  const { data: userRes, error: userErr } = await service.auth.admin.getUserById(userId)
  const adminUser = userRes?.user ?? null
  if (userErr || !adminUser) {
    return { ok: false, reason: `auth user not found: ${userErr?.message ?? userId}` }
  }
  const fullNameRaw = (adminUser.user_metadata?.full_name as string | undefined)?.trim()
  const firstName = fullNameRaw?.split(' ')[0]?.trim() || 'Coach'
  const fullName = fullNameRaw || firstName
  const workspaceName = `${firstName}'s Workspace`

  // 5. Workspace — adopt one this user already owns (from a crashed earlier attempt),
  //    otherwise create it.
  let workspaceId: string
  const { data: ownedWs, error: ownedErr } = await service
    .from('workspaces')
    .select('id, stripe_customer_id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (ownedErr) return { ok: false, reason: `workspace lookup failed: ${ownedErr.message}` }
  if (ownedWs?.id) {
    workspaceId = ownedWs.id as string
    if (input.stripeCustomerId && ownedWs.stripe_customer_id !== input.stripeCustomerId) {
      await service
        .from('workspaces')
        .update({ stripe_customer_id: input.stripeCustomerId })
        .eq('id', workspaceId)
    }
  } else {
    const { data: createdWs, error: wsErr } = await service
      .from('workspaces')
      .insert({
        name: workspaceName,
        owner_id: userId,
        stripe_customer_id: input.stripeCustomerId,
      })
      .select('id')
      .single()
    if (wsErr || !createdWs?.id) {
      return { ok: false, reason: `workspace insert failed: ${wsErr?.message ?? 'no row returned'}` }
    }
    workspaceId = createdWs.id as string
  }

  // 6. Profile — PK upsert, idempotent.
  const { error: profileErr } = await service.from('profiles').upsert(
    {
      id: userId,
      email: adminUser.email ?? '',
      full_name: fullName,
      role: 'coach',
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (profileErr) return { ok: false, reason: `profile upsert failed: ${profileErr.message}` }

  // 7. Coach row — UNIQUE(user_id, workspace_id); 23505 means already linked.
  const { error: coachErr } = await service.from('coaches').insert({
    user_id: userId,
    workspace_id: workspaceId,
    role: 'owner',
  })
  if (coachErr && coachErr.code !== '23505') {
    return { ok: false, reason: `coach insert failed: ${coachErr.message}` }
  }

  // 8. Subscription row.
  const subErr = await ensureSubscriptionRow(service, workspaceId, input)
  if (subErr) return { ok: false, reason: subErr }

  return { ok: true, workspaceId, alreadyActive: false }
}
