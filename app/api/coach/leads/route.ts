import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkLeadSearchLimit } from '@/lib/plan-limits'

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
    return NextResponse.json({ data: { searches: data ?? [], limit } })
  } catch (err) {
    console.error('GET /api/coach/leads', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
