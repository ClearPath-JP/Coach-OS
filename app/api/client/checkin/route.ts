import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { applyDailyCheckinXpAndStreak } from '@/lib/daily-checkin-rewards'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { clientDailyCheckinSchema } from '@/lib/validations'
import { XP_ACTIONS } from '@/lib/xp-system'

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * POST /api/client/checkin — one check-in per UTC day; awards XP and updates streak.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-checkin:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = clientDailyCheckinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const moodScore = parsed.data.moodScore
    const energyScore = parsed.data.energyScore ?? null
    const noteRaw = parsed.data.note
    const note = noteRaw != null && String(noteRaw).trim() !== '' ? String(noteRaw).trim().slice(0, 300) : null

    const today = utcToday()

    const { data: existing, error: exErr } = await supabase
      .from('daily_checkins')
      .select('id, workspace_id, client_id, mood_score, energy_score, note, checkin_date, created_at')
      .eq('client_id', clientId)
      .eq('checkin_date', today)
      .maybeSingle()

    if (exErr) {
      return NextResponse.json({ error: 'Could not verify check-in' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({
        alreadyCheckedIn: true,
        existing: {
          id: existing.id,
          moodScore: existing.mood_score,
          energyScore: existing.energy_score,
          note: existing.note,
          checkinDate: existing.checkin_date,
          createdAt: existing.created_at,
        },
      })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('daily_checkins')
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        mood_score: moodScore,
        energy_score: energyScore,
        note,
        checkin_date: today,
      })
      .select('id, workspace_id, client_id, mood_score, energy_score, note, checkin_date, created_at')
      .single()

    if (insErr) {
      if (insErr.code === '23505') {
        const { data: again } = await supabase
          .from('daily_checkins')
          .select('id, workspace_id, client_id, mood_score, energy_score, note, checkin_date, created_at')
          .eq('client_id', clientId)
          .eq('checkin_date', today)
          .maybeSingle()
        if (again) {
          return NextResponse.json({
            alreadyCheckedIn: true,
            existing: {
              id: again.id,
              moodScore: again.mood_score,
              energyScore: again.energy_score,
              note: again.note,
              checkinDate: again.checkin_date,
              createdAt: again.created_at,
            },
          })
        }
      }
      return NextResponse.json({ error: 'Could not save check-in' }, { status: 500 })
    }

    let streakDays = 1
    let isNewStreakRecord = false
    try {
      const service = createServiceClient()
      const streakResult = await applyDailyCheckinXpAndStreak(service, clientId, workspaceId)
      streakDays = streakResult.streakDays
      isNewStreakRecord = streakResult.isNewStreakRecord
    } catch {
      return NextResponse.json({ error: 'Check-in saved but rewards could not update — contact support' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        checkin: {
          id: inserted.id,
          moodScore: inserted.mood_score,
          energyScore: inserted.energy_score,
          note: inserted.note,
          checkinDate: inserted.checkin_date,
          createdAt: inserted.created_at,
        },
        xpAwarded: XP_ACTIONS.DAILY_CHECKIN,
        streakDays,
        isNewStreakRecord,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
