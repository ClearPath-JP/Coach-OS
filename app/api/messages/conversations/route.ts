import { NextResponse } from 'next/server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

function previewForMessage(content: string, messageType: string | null | undefined): string {
  if (messageType === 'invoice') return 'Invoice'
  if (messageType === 'session') return 'Session booking'
  return content ?? ''
}

type RpcRow = {
  client_id: string
  first_name: string | null
  last_name: string | null
  status: string | null
  unread_count: number | string | null
  last_message_at: string | null
  last_message_preview: string | null
}

/**
 * GET /api/messages/conversations
 * Coach only. Up to 20 active clients with last message preview, timestamp, unread count.
 * Uses DB RPC `get_coach_conversations` (single round-trip).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`messages-conversations:${user.id}`, {
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

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ws = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!ws) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_coach_conversations', {
      p_workspace_id: ws,
      p_coach_user_id: user.id,
    })

    if (rpcError) {
      console.error('messages/conversations rpc', rpcError)
      return NextResponse.json(
        { error: 'Unable to load conversations. Please refresh the page.' },
        { status: 500 }
      )
    }

    const rows = (rpcRows ?? []) as RpcRow[]
    const summaries = rows.map((r) => {
      const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown'
      const lastMessageAt = r.last_message_at ?? ''
      const hasMessages = Boolean(lastMessageAt)
      const rawPreview = r.last_message_preview ?? ''
      const previewFromRpc =
        rawPreview === 'Invoice' || rawPreview === 'Session booking'
          ? rawPreview
          : previewForMessage(rawPreview, null)
      let lastMessagePreview = ''
      if (hasMessages) {
        lastMessagePreview =
          previewFromRpc.length > 50 ? previewFromRpc.slice(0, 50).trim() + '…' : previewFromRpc
      }
      const unreadRaw = r.unread_count
      const unreadCount =
        typeof unreadRaw === 'string' ? parseInt(unreadRaw, 10) || 0 : unreadRaw ?? 0

      return {
        clientId: r.client_id,
        fullName,
        status: r.status ?? 'active',
        lastMessagePreview,
        lastMessageAt,
        unreadCount,
        hasMessages,
      }
    })

    const res = NextResponse.json({ data: summaries })
    res.headers.set('Cache-Control', 'private, max-age=15')
    return res
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
