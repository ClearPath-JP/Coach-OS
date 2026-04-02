import type { SupabaseClient } from '@supabase/supabase-js'
import { levelNumberFromXp, XP_ACTIONS } from '@/lib/xp-system'

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * After a daily check-in row exists for today: add XP and update check-in streak on client_rewards (service role).
 */
export async function applyDailyCheckinXpAndStreak(
  service: SupabaseClient,
  clientId: string,
  workspaceId: string
): Promise<{ streakDays: number; isNewStreakRecord: boolean }> {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayStr = utcDateString(yesterday)

  const { data: yRow } = await service
    .from('daily_checkins')
    .select('id')
    .eq('client_id', clientId)
    .eq('checkin_date', yesterdayStr)
    .maybeSingle()

  const hadYesterday = !!yRow

  const { data: rewards } = await service
    .from('client_rewards')
    .select('id, total_xp, current_streak_days, longest_streak_days')
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const prevLongest = rewards?.longest_streak_days ?? 0
  const prevCurrent = rewards?.current_streak_days ?? 0
  const newStreak = hadYesterday ? prevCurrent + 1 : 1
  const newLongest = Math.max(prevLongest, newStreak)
  const isNewStreakRecord = newStreak > prevLongest
  const nextXp = (rewards?.total_xp ?? 0) + XP_ACTIONS.DAILY_CHECKIN
  const nowIso = new Date().toISOString()

  if (rewards?.id) {
    await service
      .from('client_rewards')
      .update({
        total_xp: nextXp,
        level: levelNumberFromXp(nextXp),
        current_streak_days: newStreak,
        longest_streak_days: newLongest,
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
      current_streak_days: newStreak,
      longest_streak_days: newLongest,
      last_activity_at: nowIso,
      assignments_total: 0,
      assignments_completed: 0,
      updated_at: nowIso,
    })
  }

  return { streakDays: newStreak, isNewStreakRecord }
}
