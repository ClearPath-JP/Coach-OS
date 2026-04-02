import { NextResponse } from 'next/server'
import { differenceInCalendarDays, eachDayOfInterval, startOfDay, subDays } from 'date-fns'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type CheckinRow = {
  id: string
  client_id: string
  mood_score: number
  energy_score: number | null
  note: string | null
  checkin_date: string
  created_at: string
}

function parseDays(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : 30
  if (!Number.isFinite(n) || n < 1) return 30
  return Math.min(365, n)
}

function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

/**
 * GET /api/coach/checkins
 * ?alerts=true — low mood + missed check-in alerts
 * ?clientId=&days= — single client trend + history
 * default — latest check-in per active client
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`coach-checkins:${user.id}`, {
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

    const url = new URL(request.url)
    const alerts = url.searchParams.get('alerts') === 'true'
    const clientId = url.searchParams.get('clientId')
    const days = parseDays(url.searchParams.get('days'))

    if (clientId) {
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRe.test(clientId)) {
        return NextResponse.json({ error: 'Invalid client' }, { status: 400 })
      }

      const { data: cl, error: cErr } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .eq('id', clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (cErr || !cl) {
        return NextResponse.json({ error: "We couldn't find that client" }, { status: 404 })
      }

      const end = new Date()
      const start = subDays(startOfDay(end), days - 1)
      const startStr = utcDayString(start)

      const { data: rows, error: qErr } = await supabase
        .from('daily_checkins')
        .select('id, client_id, mood_score, energy_score, note, checkin_date, created_at')
        .eq('workspace_id', workspaceId)
        .eq('client_id', clientId)
        .gte('checkin_date', startStr)
        .order('checkin_date', { ascending: true })

      if (qErr) {
        return NextResponse.json({ error: 'Could not load check-ins' }, { status: 500 })
      }

      const list = (rows ?? []) as CheckinRow[]
      const byDate = new Map(list.map((r) => [r.checkin_date, r]))
      const intervalDays = eachDayOfInterval({ start, end: startOfDay(end) })
      let missedDays = 0
      for (const d of intervalDays) {
        const key = utcDayString(d)
        if (!byDate.has(key)) missedDays += 1
      }

      const moods = list.map((r) => r.mood_score)
      const energies = list.map((r) => r.energy_score).filter((e): e is number => e != null)
      const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null
      const avgEnergy = energies.length ? energies.reduce((a, b) => a + b, 0) / energies.length : null

      const { data: rewards } = await supabase
        .from('client_rewards')
        .select('current_streak_days')
        .eq('client_id', clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      const { count: totalCheckins } = await supabase
        .from('daily_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('client_id', clientId)

      return NextResponse.json({
        data: {
          client: {
            id: cl.id,
            firstName: cl.first_name,
            lastName: cl.last_name,
          },
          checkins: list.map((r) => ({
            id: r.id,
            moodScore: r.mood_score,
            energyScore: r.energy_score,
            note: r.note,
            checkinDate: r.checkin_date,
            createdAt: r.created_at,
          })),
          trend: {
            avgMood: avgMood != null ? Math.round(avgMood * 10) / 10 : null,
            avgEnergy: avgEnergy != null ? Math.round(avgEnergy * 10) / 10 : null,
            totalCheckins: list.length,
            missedDays,
            currentStreak: rewards?.current_streak_days ?? 0,
            totalCheckinsAllTime: totalCheckins ?? 0,
          },
        },
      })
    }

    if (alerts) {
      const now = new Date()
      const d1 = utcDayString(subDays(startOfDay(now), 1))
      const d2 = utcDayString(subDays(startOfDay(now), 2))
      const d3 = utcDayString(subDays(startOfDay(now), 3))

      const { data: activeClients, error: acErr } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')

      if (acErr) {
        return NextResponse.json({ error: 'Could not load clients' }, { status: 500 })
      }

      const lookback = utcDayString(subDays(startOfDay(now), 120))
      const { data: allCheckins, error: allErr } = await supabase
        .from('daily_checkins')
        .select('client_id, mood_score, checkin_date')
        .eq('workspace_id', workspaceId)
        .gte('checkin_date', lookback)

      if (allErr) {
        return NextResponse.json({ error: 'Could not load check-ins' }, { status: 500 })
      }

      const byClient = new Map<string, { mood_score: number; checkin_date: string }[]>()
      for (const r of allCheckins ?? []) {
        const cid = r.client_id as string
        if (!byClient.has(cid)) byClient.set(cid, [])
        byClient.get(cid)!.push({
          mood_score: r.mood_score as number,
          checkin_date: r.checkin_date as string,
        })
      }

      const lowMood: {
        clientId: string
        firstName: string | null
        lastName: string | null
        consecutiveLowDays: number
      }[] = []

      const missedCheckin: {
        clientId: string
        firstName: string | null
        lastName: string | null
        daysSinceCheckin: number
      }[] = []

      for (const c of activeClients ?? []) {
        const cid = c.id as string
        const rows = byClient.get(cid) ?? []
        const byDate = new Map(rows.map((x) => [x.checkin_date, x.mood_score]))

        const m1 = byDate.get(d1)
        const m2 = byDate.get(d2)
        const m3 = byDate.get(d3)
        if (
          m1 != null &&
          m2 != null &&
          m3 != null &&
          m1 <= 2 &&
          m2 <= 2 &&
          m3 <= 2
        ) {
          lowMood.push({
            clientId: cid,
            firstName: c.first_name as string | null,
            lastName: c.last_name as string | null,
            consecutiveLowDays: 3,
          })
        }

        if (rows.length === 0) continue

        let latest = rows[0]!.checkin_date
        for (const x of rows) {
          if (x.checkin_date > latest) latest = x.checkin_date
        }
        const lastD = parseDateOnly(latest)
        const gap = differenceInCalendarDays(startOfDay(now), startOfDay(lastD))
        if (gap >= 3) {
          missedCheckin.push({
            clientId: cid,
            firstName: c.first_name as string | null,
            lastName: c.last_name as string | null,
            daysSinceCheckin: gap,
          })
        }
      }

      const lowIds = new Set(lowMood.map((x) => x.clientId))
      const missedFiltered = missedCheckin.filter((m) => !lowIds.has(m.clientId))

      return NextResponse.json({
        data: {
          lowMood,
          missedCheckin: missedFiltered,
        },
      })
    }

    const { data: activeClients, error: acErr2 } = await supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    if (acErr2) {
      return NextResponse.json({ error: 'Could not load clients' }, { status: 500 })
    }

    const since = utcDayString(subDays(startOfDay(new Date()), 180))
    const { data: recent, error: rErr } = await supabase
      .from('daily_checkins')
      .select('id, client_id, mood_score, energy_score, note, checkin_date, created_at')
      .eq('workspace_id', workspaceId)
      .gte('checkin_date', since)
      .order('checkin_date', { ascending: false })

    if (rErr) {
      return NextResponse.json({ error: 'Could not load check-ins' }, { status: 500 })
    }

    const activeIds = new Set((activeClients ?? []).map((c) => c.id as string))

    const latestByClient = new Map<string, CheckinRow>()
    for (const row of (recent ?? []) as CheckinRow[]) {
      if (!activeIds.has(row.client_id)) continue
      if (!latestByClient.has(row.client_id)) latestByClient.set(row.client_id, row)
    }

    const summaries = (activeClients ?? []).map((c) => {
        const cid = c.id as string
        const last = latestByClient.get(cid)
        return {
          clientId: cid,
          firstName: c.first_name as string | null,
          lastName: c.last_name as string | null,
          lastCheckin: last
            ? {
                id: last.id,
                moodScore: last.mood_score,
                energyScore: last.energy_score,
                note: last.note,
                checkinDate: last.checkin_date,
                createdAt: last.created_at,
              }
            : null,
        }
      })

    return NextResponse.json({ data: { summaries } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
