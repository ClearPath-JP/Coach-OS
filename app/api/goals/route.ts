import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { goalProgressPercent } from '@/lib/goal-progress'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createClientGoalSchema } from '@/lib/validations'

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

type UpdateRow = {
  id: string
  previous_value: number | null
  new_value: number
  note: string | null
  created_at: string
  recorded_by: string
}

function shapeGoal(g: GoalRow, latest: UpdateRow | null, updates?: ReturnType<typeof mapUpdates>) {
  const progressPercent = goalProgressPercent({
    targetValue: g.target_value,
    startValue: g.start_value,
    currentValue: g.current_value,
  })
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
    progressPercent,
    latestUpdate: latest
      ? {
          id: latest.id,
          previousValue: latest.previous_value,
          newValue: latest.new_value,
          note: latest.note,
          createdAt: latest.created_at,
          recordedBy: latest.recorded_by,
        }
      : null,
    ...(updates !== undefined ? { updates } : {}),
  }
}

function mapUpdates(
  ups: {
    id: string
    previous_value: number | null
    new_value: number
    note: string | null
    created_at: string
    recorded_by: string
  }[]
) {
  return ups.map((u) => ({
    id: u.id,
    previousValue: u.previous_value,
    newValue: u.new_value,
    note: u.note,
    createdAt: u.created_at,
    recordedBy: u.recorded_by,
  }))
}

/**
 * GET /api/goals?clientId=&includeUpdates=1
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`goals-get:${user.id}`, {
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

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')?.trim()
    const includeUpdates = searchParams.get('includeUpdates') === '1'
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    const { data: client, error: cErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (cErr || !client) {
      return NextResponse.json({ error: "We couldn't find that client" }, { status: 404 })
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

    const byGoal = new Map<string, typeof allUpdates>()
    for (const u of allUpdates ?? []) {
      const gid = u.goal_id as string
      if (!byGoal.has(gid)) byGoal.set(gid, [])
      byGoal.get(gid)!.push(u)
    }

    const shaped = list.map((g) => {
      const ups = byGoal.get(g.id) ?? []
      const latest = ups[0]
        ? {
            id: ups[0].id as string,
            previous_value: ups[0].previous_value as number | null,
            new_value: ups[0].new_value as number,
            note: ups[0].note as string | null,
            created_at: ups[0].created_at as string,
            recorded_by: ups[0].recorded_by as string,
          }
        : null
      if (!includeUpdates) {
        return shapeGoal(g, latest)
      }
      const rawUps = ups.map((u) => ({
        id: u.id as string,
        previous_value: u.previous_value as number | null,
        new_value: u.new_value as number,
        note: u.note as string | null,
        created_at: u.created_at as string,
        recorded_by: u.recorded_by as string,
      }))
      return shapeGoal(g, latest, mapUpdates(rawUps))
    })

    return NextResponse.json({ data: shaped })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/goals
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`goals-post:${user.id}`, {
      windowMs: 60_000,
      max: 60,
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
    const parsed = createClientGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { data: client, error: cErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.data.clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (cErr || !client) {
      return NextResponse.json({ error: "We couldn't find that client" }, { status: 404 })
    }

    const start = parsed.data.startValue ?? null
    const target = parsed.data.targetValue ?? null
    const current =
      parsed.data.currentValue ??
      (start != null ? start : target != null ? 0 : 0)

    const insertRow = {
      workspace_id: workspaceId,
      client_id: parsed.data.clientId,
      coach_id: user.id,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? null,
      category: parsed.data.category ?? 'general',
      target_value: target,
      start_value: start,
      current_value: current,
      unit: parsed.data.unit?.trim() ?? null,
      target_date: parsed.data.targetDate ?? null,
    }

    const { data: row, error: insErr } = await supabase
      .from('client_goals')
      .insert(insertRow)
      .select(
        'id, workspace_id, client_id, coach_id, title, description, category, target_value, current_value, unit, start_value, target_date, status, achieved_at, created_at, updated_at'
      )
      .single()

    if (insErr || !row) {
      return NextResponse.json({ error: 'Could not create goal' }, { status: 500 })
    }

    const g = row as GoalRow
    return NextResponse.json({
      data: shapeGoal(g, null),
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
