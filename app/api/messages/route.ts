import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/utils'
import { sendMessageSchema } from '@/lib/validations'

const MESSAGE_PAGE_SIZE = 50

/**
 * GET /api/messages?clientId=[id]&before=[iso]&limit=
 * Newest page first (no `before`); older pages with `before=<oldest_created_at_in_ui>`.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`messages-get:${user.id}`, {
      windowMs: 60_000,
      max: 100,
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
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    const before = searchParams.get('before')?.trim()
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(MESSAGE_PAGE_SIZE), 10) || MESSAGE_PAGE_SIZE)
    )

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, workspace_id, email')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('workspace_id', client.workspace_id)
      .maybeSingle()

    const isCoach = coach?.user_id === user.id
    const isClient =
      !!user.email && normalizeEmail(client.email) === normalizeEmail(user.email)
    if (!isCoach && !isClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fetchSize = limit + 1
    let query = supabase
      .from('messages')
      .select('id, workspace_id, sender_id, recipient_id, client_id, content, read_at, created_at, message_type')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(fetchSize)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load messages' },
        { status: 500 }
      )
    }

    const list = rows ?? []
    const hasMore = list.length > limit
    const slice = hasMore ? list.slice(0, limit) : list
    const chronological = [...slice].reverse()
    const nextCursor =
      chronological.length > 0 ? chronological[0]?.created_at ?? null : null

    return NextResponse.json({
      data: chronological,
      hasMore,
      nextCursor,
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/messages
 * Body: { clientId, content }
 * Sets sender_id = current user, recipient_id = the other party.
 * Rate limit: 60 per minute per user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`messages-send:${user.id}`, {
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
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { clientId, content } = parsed.data
    const contentStored = content.slice(0, 2000)

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, workspace_id, email')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: coachViaRls } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('workspace_id', client.workspace_id)
      .maybeSingle()

    const isCoach = coachViaRls?.user_id === user.id
    const isClient =
      !!user.email &&
      normalizeEmail(user.email) === normalizeEmail(client.email ?? '')

    if (!isCoach && !isClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let coach = coachViaRls
    if (!coach && isClient) {
      const svc = createServiceClient()
      const { data } = await svc
        .from('coaches')
        .select('user_id')
        .eq('workspace_id', client.workspace_id)
        .limit(1)
        .maybeSingle()
      coach = data ?? null
    }

    if (!coach) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    let recipient_id: string
    if (isCoach) {
      if (!client.email) {
        return NextResponse.json(
          { error: "This client doesn't have an account yet — they need to accept an invite first" },
          { status: 400 }
        )
      }
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizeEmail(client.email ?? ''))
        .maybeSingle()
      if (!clientProfile) {
        return NextResponse.json(
          { error: "This client doesn't have an account yet — they need to accept an invite first" },
          { status: 400 }
        )
      }
      recipient_id = clientProfile.id
    } else {
      recipient_id = coach.user_id
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        workspace_id: client.workspace_id,
        sender_id: user.id,
        recipient_id,
        client_id: clientId,
        content: contentStored,
      })
      .select('id, workspace_id, sender_id, recipient_id, client_id, content, read_at, created_at, message_type')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not send message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: message })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
