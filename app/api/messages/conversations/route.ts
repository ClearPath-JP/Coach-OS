import { NextResponse } from 'next/server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const RECENT_MESSAGE_SCAN_LIMIT = 4000
const CONVERSATION_CAP = 20

function previewForMessage(content: string, messageType: string | null | undefined): string {
  if (messageType === 'invoice') return 'Invoice'
  if (messageType === 'session') return 'Session booking'
  return content ?? ''
}

type LastRow = {
  content: string
  createdAt: string
  messageType: string | null | undefined
}

/**
 * GET /api/messages/conversations
 * Coach only. Up to 20 active clients, prioritizing those with recent messages.
 * For each: last message preview, timestamp, unread count (for the coach).
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

    const { data: allClients, error: clientsFetchError } = await supabase
      .from('clients')
      .select('id, first_name, last_name, status')
      .eq('workspace_id', ws)
      .eq('status', 'active')

    if (clientsFetchError) {
      return NextResponse.json(
        { error: clientsFetchError.message || 'Could not load clients' },
        { status: 500 }
      )
    }

    const clientsList = allClients ?? []
    if (clientsList.length === 0) {
      const res = NextResponse.json({ data: [] })
      res.headers.set('Cache-Control', 'private, max-age=15')
      return res
    }

    const activeById = new Map(clientsList.map((c) => [c.id, c]))

    const { data: recentRows, error: recentErr } = await supabase
      .from('messages')
      .select('client_id, content, read_at, created_at, message_type')
      .eq('workspace_id', ws)
      .not('client_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(RECENT_MESSAGE_SCAN_LIMIT)

    if (recentErr) {
      return NextResponse.json(
        { error: recentErr.message || 'Could not load conversations' },
        { status: 500 }
      )
    }

    const lastFromScan = new Map<string, LastRow>()
    const recentOrder: string[] = []
    const seenOrder = new Set<string>()

    for (const m of recentRows ?? []) {
      const cid = m.client_id as string
      if (!activeById.has(cid)) continue
      if (!lastFromScan.has(cid)) {
        lastFromScan.set(cid, {
          content: previewForMessage(m.content ?? '', m.message_type),
          createdAt: m.created_at ?? '',
          messageType: m.message_type,
        })
      }
      if (!seenOrder.has(cid)) {
        seenOrder.add(cid)
        recentOrder.push(cid)
      }
    }

    const selectedIds: string[] = []
    for (const cid of recentOrder) {
      if (selectedIds.length >= CONVERSATION_CAP) break
      selectedIds.push(cid)
    }
    if (selectedIds.length < CONVERSATION_CAP) {
      const rest = [...clientsList]
        .filter((c) => !selectedIds.includes(c.id))
        .sort((a, b) => {
          const an = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Unknown'
          const bn = [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Unknown'
          return an.localeCompare(bn, undefined, { sensitivity: 'base' })
        })
      for (const c of rest) {
        if (selectedIds.length >= CONVERSATION_CAP) break
        selectedIds.push(c.id)
      }
    }

    const summaries = await Promise.all(
      selectedIds.map(async (clientId) => {
        let last = lastFromScan.get(clientId)
        if (!last) {
          const { data: row, error: oneErr } = await supabase
            .from('messages')
            .select('content, created_at, message_type')
            .eq('workspace_id', ws)
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (oneErr || !row) {
            last = undefined
          } else {
            last = {
              content: previewForMessage(row.content ?? '', row.message_type),
              createdAt: row.created_at ?? '',
              messageType: row.message_type,
            }
          }
        }

        const { count, error: countErr } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws)
          .eq('client_id', clientId)
          .is('read_at', null)
          .eq('recipient_id', user.id)

        const unreadCount = countErr ? 0 : count ?? 0

        const c = activeById.get(clientId)!
        const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown'
        const hasMessages = Boolean(last && last.createdAt)

        let lastMessagePreview = ''
        let lastMessageAt = ''
        if (last && last.createdAt) {
          const preview =
            last.content.length > 50 ? last.content.slice(0, 50).trim() + '…' : last.content
          lastMessagePreview = preview
          lastMessageAt = last.createdAt
        }

        return {
          clientId,
          fullName,
          status: c.status ?? 'active',
          lastMessagePreview,
          lastMessageAt,
          unreadCount,
          hasMessages,
        }
      })
    )

    summaries.sort((a, b) => {
      if (a.hasMessages && !b.hasMessages) return -1
      if (!a.hasMessages && b.hasMessages) return 1
      if (a.hasMessages && b.hasMessages) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      }
      return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' })
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
