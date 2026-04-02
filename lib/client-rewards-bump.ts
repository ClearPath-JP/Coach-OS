import type { SupabaseClient } from '@supabase/supabase-js'
import { levelNumberFromXp } from '@/lib/xp-system'

export async function bumpClientXp(
  service: SupabaseClient,
  clientId: string,
  workspaceId: string,
  deltaXp: number
): Promise<void> {
  if (deltaXp <= 0) return
  const nowIso = new Date().toISOString()
  const { data: rewards } = await service
    .from('client_rewards')
    .select('id, total_xp')
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const nextXp = (rewards?.total_xp ?? 0) + deltaXp
  if (rewards?.id) {
    await service
      .from('client_rewards')
      .update({
        total_xp: nextXp,
        level: levelNumberFromXp(nextXp),
        last_activity_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', rewards.id)
  } else {
    await service.from('client_rewards').insert({
      workspace_id: workspaceId,
      client_id: clientId,
      total_xp: nextXp,
      level: levelNumberFromXp(nextXp),
      last_activity_at: nowIso,
      assignments_total: 0,
      updated_at: nowIso,
    })
  }
}
