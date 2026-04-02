import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { goalProgressPercent } from '@/lib/goal-progress'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type GoalRow = {
  id: string
  workspace_id: string
  client_id: string
  coach_id: string
  title: string
  description: string | null
  category: string | null
  target_value: number | null
  current_value: number | null
  unit: string | null
  start_value: number | null
  target_date: string | null
  status: string
  achieved_at: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/client/goals — same enriched shape as coach list + full update history per goal.
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-goals-get:${user.id}`, {
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

    const { data: goals, error: gErr } = await supabase
      .from('client_goals')
      .select(
        'id, workspace_id, client_id, coach_id, title, description, category, target_value, current_value, unit, start_value, target_date, status, achieved_at, created_at, updated_at'
      )
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (gErr) {
      return NextResponse.json({ error: 'Could not load goals' }, { status: 500 })
    }

    const list = (goals ?? []) as GoalRow[]
    const goalIds = list.map((g) => g.id)
    if (goalIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const { data: allUpdates, error: uErr } = await supabase
      .from('client_goal_updates')
      .select('id, goal_id, previous_value, new_value, note, created_at, recorded_by')
      .in('goal_id', goalIds)
      .order('created_at', { ascending: false })

    if (uErr) {
      return NextResponse.json({ error: 'Could not load goal updates' }, { status: 500 })
    }

    const byGoal = new Map<string, NonNullable<typeof allUpdates>>()
    for (const u of allUpdates ?? []) {
      const gid = u.goal_id as string
      if (!byGoal.has(gid)) byGoal.set(gid, [])
      byGoal.get(gid)!.push(u)
    }

    const shaped = list.map((g) => {
      const ups = byGoal.get(g.id) ?? []
      const latest = ups[0]
      const latestDto = latest
        ? {
            id: latest.id as string,
            previousValue: latest.previous_value as number | null,
            newValue: latest.new_value as number,
            note: latest.note as string | null,
            createdAt: latest.created_at as string,
            recordedBy: latest.recorded_by as string,
          }
        : null
      const updates = ups.map((u) => ({
        id: u.id as string,
        previousValue: u.previous_value as number | null,
        newValue: u.new_value as number,
        note: u.note as string | null,
        createdAt: u.created_at as string,
        recordedBy: u.recorded_by as string,
      }))
      return {
        id: g.id,
        workspaceId: g.workspace_id,
        clientId: g.client_id,
        coachId: g.coach_id,
        title: g.title,
        description: g.description,
        category: g.category ?? 'general',
        targetValue: g.target_value,
        currentValue: g.current_value,
        unit: g.unit,
        startValue: g.start_value,
        targetDate: g.target_date,
        status: g.status,
        achievedAt: g.achieved_at,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        progressPercent: goalProgressPercent({
          targetValue: g.target_value,
          startValue: g.start_value,
          currentValue: g.current_value,
        }),
        latestUpdate: latestDto,
        updates,
      }
    })

    return NextResponse.json({ data: shaped })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
