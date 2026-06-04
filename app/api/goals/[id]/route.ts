import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { bumpClientXp } from '@/lib/client-rewards-bump'
import { goalProgressPercent } from '@/lib/goal-progress'
import { notifyCoachGoalAchieved } from '@/lib/notifications/coach-activity-email'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { XP_ACTIONS } from '@/lib/xp-system'
import { patchClientGoalSchema } from '@/lib/validations'

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

function shapeResponse(
  g: GoalRow,
  latest: {
    id: string
    previous_value: number | null
    new_value: number
    note: string | null
    created_at: string
    recorded_by: string
  } | null
) {
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
  }
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id: goalId } = await context.params

    const { success, retryAfter } = await checkRateLimitAsync(`goals-patch:${user.id}`, {
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

    const body = await request.json()
    const parsed = patchClientGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { data: existing, error: loadErr } = await supabase
      .from('client_goals')
      .select(
        'id, workspace_id, client_id, coach_id, title, description, category, target_value, current_value, unit, start_value, target_date, status, achieved_at, created_at, updated_at'
      )
      .eq('id', goalId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (loadErr || !existing) {
      return NextResponse.json({ error: "We couldn't find that goal" }, { status: 404 })
    }

    const row = existing as GoalRow
    const wasAchieved = row.status === 'achieved'
    let nextCurrent = row.current_value ?? 0
    let nextStatus = row.status
    let nextAchievedAt = row.achieved_at
    const nowIso = new Date().toISOString()

    if (parsed.data.currentValue !== undefined) {
      const prev = row.current_value ?? 0
      nextCurrent = parsed.data.currentValue
      const { error: insUpdErr } = await supabase.from('client_goal_updates').insert({
        goal_id: row.id,
        workspace_id: workspaceId,
        recorded_by: user.id,
        previous_value: prev,
        new_value: nextCurrent,
        note: parsed.data.note?.trim() ?? null,
      })
      if (insUpdErr) {
        return NextResponse.json({ error: 'Could not record goal update' }, { status: 500 })
      }

      const target = row.target_value
      if (target != null && nextCurrent >= Number(target) && nextStatus === 'active') {
        nextStatus = 'achieved'
        nextAchievedAt = nowIso
      }
    }

    if (parsed.data.status !== undefined) {
      nextStatus = parsed.data.status
      if (nextStatus === 'achieved' && !nextAchievedAt) {
        nextAchievedAt = nowIso
      }
      if (nextStatus !== 'achieved') {
        nextAchievedAt = null
      }
    }

    const patch: Record<string, unknown> = {}
    if (parsed.data.currentValue !== undefined) {
      patch.current_value = nextCurrent
      patch.status = nextStatus
      patch.achieved_at = nextAchievedAt
    } else if (parsed.data.status !== undefined) {
      patch.status = nextStatus
      patch.achieved_at = nextAchievedAt
    }
    if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim()
    if (parsed.data.targetDate !== undefined) patch.target_date = parsed.data.targetDate

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: updated, error: upErr } = await supabase
      .from('client_goals')
      .update(patch)
      .eq('id', goalId)
      .eq('workspace_id', workspaceId)
      .select(
        'id, workspace_id, client_id, coach_id, title, description, category, target_value, current_value, unit, start_value, target_date, status, achieved_at, created_at, updated_at'
      )
      .single()

    if (upErr || !updated) {
      return NextResponse.json({ error: 'Could not update goal' }, { status: 500 })
    }

    const u = updated as GoalRow
    const newlyAchieved = !wasAchieved && u.status === 'achieved'
    if (newlyAchieved) {
      await bumpClientXp(supabase, u.client_id, workspaceId, XP_ACTIONS.GOAL_ACHIEVED)
      const { data: cl } = await supabase
        .from('clients')
        .select('first_name, last_name')
        .eq('id', u.client_id)
        .maybeSingle()
      const clientName =
        [cl?.first_name, cl?.last_name].filter(Boolean).join(' ').trim() || 'Client'
      void notifyCoachGoalAchieved({
        coachUserId: user.id,
        clientName,
        goalTitle: u.title,
        clientId: u.client_id,
        request,
      })
    }

    const { data: lastUp } = await supabase
      .from('client_goal_updates')
      .select('id, previous_value, new_value, note, created_at, recorded_by')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const latest = lastUp
      ? {
          id: lastUp.id as string,
          previous_value: lastUp.previous_value as number | null,
          new_value: lastUp.new_value as number,
          note: lastUp.note as string | null,
          created_at: lastUp.created_at as string,
          recorded_by: lastUp.recorded_by as string,
        }
      : null

    return NextResponse.json({ data: shapeResponse(u, latest) })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id: goalId } = await context.params

    const { success, retryAfter } = await checkRateLimitAsync(`goals-del:${user.id}`, {
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

    const { data: existing } = await supabase
      .from('client_goals')
      .select('id')
      .eq('id', goalId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: "We couldn't find that goal" }, { status: 404 })
    }

    const { error: delErr } = await supabase.from('client_goals').delete().eq('id', goalId).eq('workspace_id', workspaceId)
    if (delErr) {
      return NextResponse.json({ error: 'Could not delete goal' }, { status: 500 })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
