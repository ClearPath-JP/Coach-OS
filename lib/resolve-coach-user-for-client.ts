import { createServiceClient } from '@/lib/supabase/service'

/**
 * Auth user id (profiles PK) of the coach who should receive client→coach messages and session requests.
 * Uses `clients.coach_id` when set (correct pairing). Otherwise first coach in workspace (owner role first).
 */
export async function resolveCoachUserIdForClientRow(clientRow: {
  workspace_id: string
  coach_id: string | null | undefined
}): Promise<string | null> {
  if (clientRow.coach_id) {
    return clientRow.coach_id
  }

  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('coaches')
    .select('user_id')
    .eq('workspace_id', clientRow.workspace_id)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)

  return rows?.[0]?.user_id ?? null
}
