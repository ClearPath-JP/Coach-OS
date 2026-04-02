import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import {
  hmToTime,
  rowToBlock,
  weeklyUnavailabilityPutSchema,
  type WeeklyUnavailabilityRowDb,
} from '@/lib/weekly-unavailability'

export async function GET() {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error

  const { supabase, user } = auth

  const { data, error } = await supabase
    .from('weekly_unavailability')
    .select('*')
    .eq('coach_user_id', user.id)
    .is('client_id', null)
    .order('day_of_week', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }

  const rows = (data ?? []) as WeeklyUnavailabilityRowDb[]
  return NextResponse.json({ data: { blocks: rows.map(rowToBlock) } })
}

export async function PUT(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error

  const { supabase, user, workspaceId } = auth

  const body = await request.json().catch(() => null)
  const parsed = weeklyUnavailabilityPutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { blocks } = parsed.data

  const { error: delErr } = await supabase
    .from('weekly_unavailability')
    .delete()
    .eq('coach_user_id', user.id)
    .is('client_id', null)

  if (delErr) {
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }

  if (blocks.length === 0) {
    return NextResponse.json({ data: { blocks: [] } })
  }

  const insertRows = blocks.map((b) => ({
    workspace_id: workspaceId,
    coach_user_id: user.id,
    client_id: null,
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
