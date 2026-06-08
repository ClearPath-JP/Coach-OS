import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/client/passes
 *
 * Returns the active passes the client can buy in their workspace, plus the client's own
 * usable balances (active, credits remaining). Uses the authenticated supabase client so RLS
 * applies: class_passes is workspace-readable; client_passes is restricted to the client's
 * own rows.
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-passes-get:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests — please wait a moment' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: availRaw, error: availErr } = await supabase
      .from('class_passes')
      .select('id, title, description, price_cents, currency, credit_count, applies_to, applies_to_types, expires_in_days')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('price_cents', { ascending: true })

    if (availErr) {
      console.error('GET /api/client/passes — available query', availErr)
      return NextResponse.json({ error: 'Could not load passes' }, { status: 500 })
    }

    const { data: balRaw, error: balErr } = await supabase
      .from('client_passes')
      .select('id, credits_total, credits_remaining, expires_at, purchased_at, class_passes:pass_id ( title )')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .gt('credits_remaining', 0)
      .order('purchased_at', { ascending: true })

    if (balErr) {
      console.error('GET /api/client/passes — balances query', balErr)
      return NextResponse.json({ error: 'Could not load your passes' }, { status: 500 })
    }

    type PassTitle = { title: string | null }
    type BalJoin = {
      id: string
      credits_total: number
      credits_remaining: number
      expires_at: string | null
      class_passes: PassTitle | PassTitle[] | null
    }
    const balances = ((balRaw as unknown as BalJoin[] | null) ?? []).map((b) => {
      const cp = Array.isArray(b.class_passes) ? b.class_passes[0] : b.class_passes
      return {
        id: b.id,
        title: cp?.title ?? 'Pass',
        credits_total: b.credits_total,
        credits_remaining: b.credits_remaining,
        expires_at: b.expires_at,
      }
    })
    const totalCredits = balances.reduce((sum, b) => sum + b.credits_remaining, 0)

    return NextResponse.json({ data: { passes: availRaw ?? [], balances, totalCredits } })
  } catch (err) {
    console.error('GET /api/client/passes', err)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
