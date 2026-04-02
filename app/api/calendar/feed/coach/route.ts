import { NextResponse } from 'next/server'
import { addDays } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCoachSessionsIcs, type IcsSessionRow } from '@/lib/build-coach-calendar-ics'

const DAYS_AHEAD = 90

/**
 * GET /api/calendar/feed/coach — iCal for coach sessions.
 * - With `?token=` (from GET /api/coach/calendar-feed-token): no browser cookie; for Google/Apple “subscribe by URL”.
 * - Without token: requires signed-in coach session (download / same-origin use).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')?.trim()

    const now = new Date()
    const end = addDays(now, DAYS_AHEAD)

    if (token) {
      let service
      try {
        service = createServiceClient()
      } catch {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 503 })
      }

      const { data: ws, error: wsErr } = await service
        .from('workspaces')
        .select('id')
        .eq('coach_calendar_feed_token', token)
        .maybeSingle()

      if (wsErr || !ws?.id) {
        return NextResponse.json({ error: 'Invalid or expired calendar link' }, { status: 401 })
      }

      const { data: sessions, error: sErr } = await service
        .from('sessions')
        .select('id, scheduled_time, end_time, duration_minutes, notes, clients ( first_name, last_name )')
        .eq('workspace_id', ws.id)
        .gte('scheduled_time', now.toISOString())
        .lte('scheduled_time', end.toISOString())
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_time')

      if (sErr) {
        return NextResponse.json({ error: 'Could not load sessions for calendar' }, { status: 500 })
      }

      const body = buildCoachSessionsIcs((sessions ?? []) as IcsSessionRow[])
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="clearpath-schedule.ics"',
          'Cache-Control': 'private, max-age=300',
        },
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, notes, clients ( first_name, last_name )')
      .eq('coach_id', user.id)
      .gte('scheduled_time', now.toISOString())
      .lte('scheduled_time', end.toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_time')

    if (error) {
      return NextResponse.json({ error: 'Could not load sessions for calendar' }, { status: 500 })
    }

    const body = buildCoachSessionsIcs((sessions ?? []) as IcsSessionRow[])
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clearpath-schedule.ics"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
