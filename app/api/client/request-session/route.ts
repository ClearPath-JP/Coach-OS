import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { resolveCoachUserIdForClientRow } from '@/lib/resolve-coach-user-for-client'
import { normalizeEmail } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null) as {
      preferredDate?: string
      preferredTime?: string
      /** Human-readable slot, e.g. "Morning · 10am–12pm" — shown to coach */
      timeSlotLabel?: string | null
      sessionTypePreference?: string
      note?: string | null
    } | null
    if (!body?.preferredDate || !body?.preferredTime) {
      return NextResponse.json({ error: 'Pick a day and a time slot' }, { status: 400 })
    }
    const formatPref = body.sessionTypePreference === 'in_person' ? 'in_person' : 'video'

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, workspace_id, coach_id')
      .eq('email', normalizeEmail(user.email))
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const coachUserId = await resolveCoachUserIdForClientRow({
      workspace_id: clientRow.workspace_id,
      coach_id: clientRow.coach_id,
    })
    if (!coachUserId) {
      return NextResponse.json(
        { error: 'No coach is linked to your workspace — please contact support.' },
        { status: 404 }
      )
    }

    const content = JSON.stringify({
      preferredDate: body.preferredDate,
      preferredTime: body.preferredTime,
      timeSlotLabel: body.timeSlotLabel?.trim() || null,
      sessionTypePreference: formatPref,
      note: body.note?.trim() || null,
    })

    const { error } = await supabase.from('messages').insert({
      workspace_id: clientRow.workspace_id,
      sender_id: user.id,
      recipient_id: coachUserId,
      client_id: clientRow.id,
      message_type: 'session_request',
      content,
    })
    if (error) return NextResponse.json({ error: error.message || 'Could not send request' }, { status: 500 })

    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — check your connection and try again' }, { status: 500 })
  }
}
