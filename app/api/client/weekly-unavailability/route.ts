import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import {
  hmToTime,
  rowToBlock,
  weeklyUnavailabilityPutSchema,
  type WeeklyUnavailabilityRowDb,
} from '@/lib/weekly-unavailability'

export async function GET() {
  const auth = await requireClient()
  if ('error' in auth) return auth.error

  const { supabase, clientId, workspaceId } = auth

  const [coachRes, mineRes] = await Promise.all([
    supabase
      .from('weekly_unavailability')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('client_id', null)
      .not('coach_user_id', 'is', null)
      .order('day_of_week', { ascending: true }),
    supabase
      .from('weekly_unavailability')
      .select('*')
      .eq('client_id', clientId)
      .order('day_of_week', { ascending: true }),
  ])

  if (coachRes.error) {
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }
  if (mineRes.error) {
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }

  const coachRows = (coachRes.data ?? []) as WeeklyUnavailabilityRowDb[]
  const mineRows = (mineRes.data ?? []) as WeeklyUnavailabilityRowDb[]

  return NextResponse.json({
    data: {
      coachBlocks: coachRows.map(rowToBlock),
      myBlocks: mineRows.map(rowToBlock),
    },
  })
}

export async function PUT(request: Request) {
  const auth = await requireClient()
  if ('error' in auth) return auth.error

  const { supabase, clientId, workspaceId } = auth

  const body = await request.json().catch(() => null)
  const parsed = weeklyUnavailabilityPutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { blocks } = parsed.data

  const { error: delErr } = await supabase.from('weekly_unavailability').delete().eq('client_id', clientId)

  if (delErr) {
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }

  if (blocks.length === 0) {
    return NextResponse.json({ data: { blocks: [] } })
  }

  const insertRows = blocks.map((b) => ({
    workspace_id: workspaceId,
    coach_user_id: null,
    client_id: clientId,
    day_of_week: b.dayOfWeek,
    all_day: b.allDay,
    start_time: b.allDay ? null : hmToTime(b.startTime!),
    end_time: b.allDay ? null : hmToTime(b.endTime!),
  }))

  const { data: inserted, error: insErr } = await supabase
    .from('weekly_unavailability')
    .insert(insertRows)
    .select('*')

  if (insErr) {
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }

  const rows = (inserted ?? []) as WeeklyUnavailabilityRowDb[]
  return NextResponse.json({ data: { blocks: rows.map(rowToBlock) } })
}
