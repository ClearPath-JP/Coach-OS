import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * GET /api/client/checkin/today — today's row (if any) + current streak from rewards.
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-checkin-today:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const today = utcToday()

    const [{ data: checkin, error: cErr }, { data: rewards, error: rErr }] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('id, mood_score, energy_score, note, checkin_date, created_at')
        .eq('client_id', clientId)
        .eq('checkin_date', today)
        .maybeSingle(),
      supabase
        .from('client_rewards')
        .select('current_streak_days')
        .eq('client_id', clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
    ])

    if (cErr || rErr) {
      return NextResponse.json({ error: 'Could not load check-in' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
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
        streakDays: rewards?.current_streak_days ?? 0,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
