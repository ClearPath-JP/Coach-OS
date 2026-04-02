import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/utils'
import { messagesBroadcastSchema } from '@/lib/validations'

/**
 * POST /api/messages/broadcast — send one text message to many active clients (coach only).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const rl = await checkRateLimitAsync(`messages-broadcast:${workspaceId}`, {
      windowMs: 60 * 60 * 1000,
      max: 1,
    })
    if (!rl.success) {
      const res = NextResponse.json(
        { error: 'You can send one broadcast per hour — try again later' },
        { status: 429 }
      )
      if (rl.retryAfter) res.headers.set('Retry-After', String(rl.retryAfter))
      return res
    }

    const rlUser = await checkRateLimitAsync(`messages-broadcast-user:${user.id}`, {
      windowMs: 60_000,
      max: 5,
    })
    if (!rlUser.success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (rlUser.retryAfter) res.headers.set('Retry-After', String(rlUser.retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = messagesBroadcastSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const content = parsed.data.content.slice(0, 2000)

    let query = supabase
      .from('clients')
      .select('id, email')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    if (parsed.data.clientIds?.length) {
      query = query.in('id', parsed.data.clientIds)
    }

    const { data: clients, error: cErr } = await query
    if (cErr) {
      return NextResponse.json({ error: 'Could not load clients' }, { status: 500 })
    }

    let sent = 0
    for (const cl of clients ?? []) {
      if (!cl.email) continue
      const email = normalizeEmail(cl.email)
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (!clientProfile) continue

      const { error: mErr } = await supabase.from('messages').insert({
        workspace_id: workspaceId,
        sender_id: user.id,
        recipient_id: clientProfile.id,
        client_id: cl.id,
        content,
        message_type: 'text',
      })
      if (!mErr) sent += 1
    }

    return NextResponse.json({ data: { sent } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
