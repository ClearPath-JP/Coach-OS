import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkLeadSearchLimit } from '@/lib/plan-limits'
import { normalizeLeadKey, type LeadStatus } from '@/lib/leads-interactions'

/**
 * GET /api/coach/leads — list recent lead searches for the coach's workspace.
 * Returns: { data: { searches: LeadSearchRow[], limit: { used, max, allowed } } }
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`leads-list:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — please wait a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data, error } = await supabase
      .from('lead_searches')
      .select(
        'id, query, status, results, result_count, cost_cents, error_message, created_at, completed_at'
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('GET /api/coach/leads', error)
      return NextResponse.json({ error: 'Could not load searches' }, { status: 500 })
    }

    const limit = await checkLeadSearchLimit(workspaceId)

    const { data: interactions, error: interactionsError } = await supabase
      .from('lead_interactions')
      .select('lead_key, status, notes, saved_client_id')
      .eq('workspace_id', workspaceId)
    if (interactionsError) {
      // Non-fatal: log and degrade gracefully — searches are still returned,
      // leads will show status 'new' until the table is available.
      console.error('GET /api/coach/leads interactions', interactionsError)
    }
    const byKey = new Map((interactions ?? []).map((i) => [i.lead_key, i]))

    const searches = (data ?? []).map((s) => ({
      ...s,
      results: Array.isArray(s.results)
        ? s.results.map((r: Record<string, unknown>) => {
            const key = normalizeLeadKey(r as { platform: 'instagram'; handle: string | null; url: string })
            const it = byKey.get(key)
            return { ...r, leadKey: key, status: (it?.status ?? 'new') as LeadStatus, notes: it?.notes ?? null, savedClientId: it?.saved_client_id ?? null }
          })
        : s.results,
    }))
    return NextResponse.json({
      data: { searches, limit },
      ...(interactionsError ? { warning: 'Lead statuses could not be loaded' } : {}),
    })
  } catch (err) {
    console.error('GET /api/coach/leads', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
