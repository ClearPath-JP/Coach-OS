import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { getLevelFromXp, getProgressPercent, getXpToNextLevel } from '@/lib/xp-system'

/**
 * GET /api/client/rewards — XP, level, streak, assignment stats for logged-in client.
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`client-rewards-get:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: row } = await supabase
      .from('client_rewards')
      .select(
        'total_xp, level, current_streak_days, longest_streak_days, last_activity_at, assignments_completed, assignments_total'
      )
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const totalXp = row?.total_xp ?? 0
    const levelInfo = getLevelFromXp(totalXp)

    return NextResponse.json({
      data: {
        totalXp,
        level: row?.level ?? levelInfo.level,
        levelName: levelInfo.name,
        xpToNextLevel: getXpToNextLevel(totalXp),
        progressPercent: getProgressPercent(totalXp),
        currentStreakDays: row?.current_streak_days ?? 0,
        longestStreakDays: row?.longest_streak_days ?? 0,
        lastActivityAt: row?.last_activity_at ?? null,
        assignmentsCompleted: row?.assignments_completed ?? 0,
        assignmentsTotal: row?.assignments_total ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
