import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/coach/calendar-feed-token — returns (and creates if missing) a long-lived calendar URL for this workspace.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`calendar-feed-token:${auth.user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many attempts — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let service
    try {
      service = createServiceClient()
    } catch {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 503 })
    }

    const { data: ws, error: wsErr } = await service
      .from('workspaces')
      .select('id, coach_calendar_feed_token')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsErr || !ws) {
      return NextResponse.json({ error: 'Could not load workspace' }, { status: 500 })
    }

    let token = typeof ws.coach_calendar_feed_token === 'string' ? ws.coach_calendar_feed_token.trim() : ''
    if (!token) {
      token = randomBytes(32).toString('hex')
      const { error: upErr } = await service
        .from('workspaces')
        .update({ coach_calendar_feed_token: token })
        .eq('id', workspaceId)
      if (upErr) {
        return NextResponse.json({ error: 'Could not create calendar link' }, { status: 500 })
      }
    }

    const base = resolveAppBaseUrl(request)
    const url = `${base}/api/calendar/feed/coach?token=${encodeURIComponent(token)}`
    return NextResponse.json({ data: { url } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
