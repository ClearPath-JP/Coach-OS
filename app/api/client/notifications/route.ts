import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'
import { format } from 'date-fns'

type SessionNotesPayload = {
  sessionId?: string
  sessionDate?: string
  summary?: string
}

/**
 * GET /api/client/notifications — unread session recap messages for the bell dropdown.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const email = normalizeEmail(profile.email ?? user.email ?? '')
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, coach_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    if (!clientRow) {
      return NextResponse.json({ data: { items: [] } })
    }

    let coachNameDefault = 'Your coach'
    if (clientRow.coach_id) {
      const { data: cp } = await supabase
        .from('profiles')
        .select('display_name, full_name')
        .eq('id', clientRow.coach_id)
        .maybeSingle()
      if (cp) {
        coachNameDefault = cp.display_name?.trim() || cp.full_name?.trim() || coachNameDefault
      }
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id, client_id')
      .eq('recipient_id', user.id)
      .eq('client_id', clientRow.id)
      .eq('message_type', 'session_notes')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(15)

    if (error) {
      return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 })
    }

    const senderIds = [...new Set((messages ?? []).map((m) => m.sender_id).filter(Boolean))]
    const { data: senderProfiles } =
      senderIds.length > 0
        ? await supabase.from('profiles').select('id, display_name, full_name').in('id', senderIds)
        : { data: [] as { id: string; display_name: string | null; full_name: string | null }[] }

    const nameById = new Map(
      (senderProfiles ?? []).map((p) => [
        p.id,
        p.display_name?.trim() || p.full_name?.trim() || coachNameDefault,
      ])
    )

    const items = (messages ?? []).map((m) => {
      let sessionDateLabel = 'recent'
      try {
        const p = JSON.parse(m.content) as SessionNotesPayload
        if (p.sessionDate) {
          sessionDateLabel = format(new Date(p.sessionDate), 'MMMM d, yyyy')
        }
      } catch {
        /* ignore */
      }
      const coachName = nameById.get(m.sender_id) ?? coachNameDefault
      return {
        id: m.id,
        title: `📋 ${coachName} sent you session notes from your ${sessionDateLabel} session`,
        body: 'Open messages to read your recap and action items',
        href: `/client/messages?messageId=${encodeURIComponent(m.id)}`,
        createdAt: m.created_at,
      }
    })

    return NextResponse.json({ data: { items } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
