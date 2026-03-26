import { NextResponse } from 'next/server'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'

type SessionRow = {
  id: string
  scheduled_time: string
  end_time: string | null
  duration_minutes: number | null
  status: string
  notes: string | null
  session_type: string | null
}

function mapSessionTypeLabel(raw: string | null | undefined): 'Video' | 'Phone' | 'In person' {
  const v = (raw ?? '').toLowerCase().trim()
  if (v === 'phone' || v === 'call') return 'Phone'
  if (v === 'in_person' || v === 'in-person' || v === 'in person') return 'In person'
  return 'Video'
}

function enrichSession(s: SessionRow) {
  const t = parseISO(s.scheduled_time)
  return {
    id: s.id,
    scheduled_time: s.scheduled_time,
    end_time: s.end_time,
    duration_minutes: s.duration_minutes,
    status: s.status,
    notes: s.notes,
    session_type: s.session_type,
    date: format(t, 'yyyy-MM-dd'),
    start_time: s.scheduled_time,
    type: mapSessionTypeLabel(s.session_type),
  }
}

/**
 * GET /api/client/sessions — fetch sessions for the authenticated client.
 * Returns upcoming (scheduled_time >= now, status pending/confirmed) and past (everything else).
 * Each row includes date, start_time (ISO), type (Video | Phone | In person), plus DB fields.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role === 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', normalizeEmail(user.email))
      .limit(1)
      .maybeSingle()
    if (!client) {
      return NextResponse.json({ data: { upcoming: [], past: [] } })
    }

    const now = new Date().toISOString()
    const { data: all } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status, notes, session_type')
      .eq('client_id', client.id)
      .order('scheduled_time', { ascending: false })

    const rows = (all ?? []) as SessionRow[]
    const upcomingRaw: SessionRow[] = []
    const pastRaw: SessionRow[] = []
    for (const s of rows) {
      if (s.scheduled_time >= now && ['pending', 'confirmed'].includes(s.status)) {
        upcomingRaw.push(s)
      } else {
        pastRaw.push(s)
      }
    }
    upcomingRaw.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))

    const upcoming = upcomingRaw.map(enrichSession)
    const past = pastRaw.map(enrichSession)

    return NextResponse.json({ data: { upcoming, past } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    )
  }
}
