import 'server-only'

import type { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Tables whose `workspace_id` FK is `ON DELETE RESTRICT` on the CHILD side and are
 * themselves workspace-scoped (so they would be cascade-targeted by the workspace delete).
 * The RESTRICT is enforced immediately and aborts the whole cascade unless the child rows
 * are gone first, so we pre-delete them BEFORE deleting the workspace.
 */
const RESTRICT_CHILD_TABLES = [
  'client_assignments',
  'client_passes',
  'client_memberships',
  'session_invoices',
] as const

/**
 * Tables whose `workspace_id` FK is `ON DELETE SET NULL`. The cascade does NOT erase them —
 * it just nulls workspace_id, so the rows survive. We DELETE them explicitly to truly erase.
 * (`profiles` is also SET NULL but is handled via auth-user deletion below.)
 */
const SET_NULL_LOG_TABLES = ['audit_logs', 'activity_log', 'frontend_error_logs'] as const

export interface PurgeWorkspaceResult {
  deletedUserIds: string[]
  authDeleteFailures: string[]
}

/**
 * REAL, irreversible erasure of a workspace and everything scoped to it (GDPR/CCPA deletion right).
 *
 * Mechanism: deleting the `workspaces` row CASCADE-deletes ~58 workspace-scoped tables. We only
 * have to handle the exceptions the cascade does NOT clean up, in the right order:
 *   1. Pre-delete RESTRICT children (else the cascade aborts).
 *   2. Delete SET-NULL log tables (else they survive with workspace_id nulled).
 *   3. Delete the workspaces row (cascades everything else).
 *   4. Delete each workspace auth user (cascades profiles + any user-owned rows).
 *
 * `svc` MUST be a service-role client (bypasses RLS); never call this with a user-scoped client.
 *
 * Partial-failure contract (no transactional rollback is possible — a cascaded workspace delete
 * cannot be undone): if the workspace delete succeeds but one or more `auth.users` deletes fail,
 * those users (and their now-orphaned `profiles` rows, whose workspace_id was nulled by the
 * SET-NULL FK) survive. This is reported via `authDeleteFailures` rather than swallowed — callers
 * MUST treat a non-empty `authDeleteFailures` as an incomplete erasure (surface an error / alert).
 * Recovery is a safe idempotent retry: `supabase.auth.admin.deleteUser` no-ops on an already-gone
 * user, so re-running the auth deletes (or this whole call) converges to full erasure.
 *
 * NOTE: Bunny-hosted video FILES are not purged here — the DB `videos` rows are cascade-deleted,
 * but the media on Bunny remains; full Bunny cleanup is a follow-up.
 */
export async function purgeWorkspace(
  svc: ServiceClient,
  workspaceId: string
): Promise<PurgeWorkspaceResult> {
  // (a) Guard — never run unscoped.
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    throw new Error('purgeWorkspace: invalid workspaceId')
  }

  // (b) Gather every auth user id tied to this workspace (coach + all client/portal users).
  const { data: profileRows, error: profilesErr } = await svc
    .from('profiles')
    .select('id')
    .eq('workspace_id', workspaceId)
  if (profilesErr) {
    throw new Error(`purgeWorkspace: could not read profiles — ${profilesErr.message}`)
  }
  const userIds = (profileRows ?? []).map((r) => r.id as string).filter(Boolean)

  // (c) Pre-delete the RESTRICT child tables (must be gone before the workspace cascade runs).
  for (const table of RESTRICT_CHILD_TABLES) {
    const { error } = await svc.from(table).delete().eq('workspace_id', workspaceId)
    if (error) {
      throw new Error(`purgeWorkspace: could not pre-delete ${table} — ${error.message}`)
    }
  }

  // (d) Delete the SET-NULL log tables (cascade would only null them, not erase them).
  for (const table of SET_NULL_LOG_TABLES) {
    const { error } = await svc.from(table).delete().eq('workspace_id', workspaceId)
    if (error) {
      throw new Error(`purgeWorkspace: could not delete ${table} — ${error.message}`)
    }
  }

  // (e) Delete the workspace — cascades the ~58 remaining workspace-scoped tables.
  //     If this errors, THROW so the caller returns 500 and nothing is half-done silently.
  const { error: wsErr } = await svc.from('workspaces').delete().eq('id', workspaceId)
  if (wsErr) {
    throw new Error(`purgeWorkspace: could not delete workspace — ${wsErr.message}`)
  }

  // (f) Delete the auth users (cascades their profiles + any user-owned rows). The workspaces
  //     row is already gone, so the workspaces->auth.users RESTRICT no longer blocks this.
  //     Collect failures; don't abort the loop on a single failure.
  const authDeleteFailures: string[] = []
  for (const userId of userIds) {
    try {
      const { error } = await svc.auth.admin.deleteUser(userId)
      if (error) authDeleteFailures.push(userId)
    } catch {
      authDeleteFailures.push(userId)
    }
  }

  return { deletedUserIds: userIds, authDeleteFailures }
}
