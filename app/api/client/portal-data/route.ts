import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { loadClientPortalBundle } from '@/lib/client-portal-bundle'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/client/portal-data — consolidated payload for the client portal home screen.
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { supabase, clientId, workspaceId, user } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-portal-data:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('first_name, coach_id')
      .eq('id', clientId)
      .maybeSingle()

    if (clientErr || !client?.coach_id) {
      return NextResponse.json({ error: 'Could not load your profile' }, { status: 500 })
    }

    const firstName = client.first_name?.trim() || 'there'

    const bundle = await loadClientPortalBundle(supabase, {
      clientId,
      workspaceId,
      coachId: client.coach_id,
      userId: user.id,
      userEmail: user.email,
    })

    const res = NextResponse.json({
      data: {
        firstName,
        ...bundle,
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=0')
    return res
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
