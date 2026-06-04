import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkLeadSearchLimit } from '@/lib/plan-limits'
import { runLeadResearch, LeadSearchUnavailableError } from '@/lib/lead-research'

const searchSchema = z.object({
  query: z.string().trim().min(5, 'Query must be at least 5 characters').max(500, 'Query too long'),
  discipline: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  radius: z.string().trim().max(40).optional(),
  idealClients: z.array(z.string().trim().max(40)).max(12).optional(),
  platform: z.string().trim().max(40).optional(),
})

/**
 * POST /api/coach/leads/search
 * Body: { query }
 * Runs a Claude API web search against the query, stores results in lead_searches,
 * returns the search row + results.
 * Plan-gated: monthly cap per workspace (PLAN_LIMITS.maxLeadSearchesPerMonth).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`leads-search:${user.id}`, {
      windowMs: 60_000,
      max: 5,
      failMode: 'closed',
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many searches — wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = searchSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { query } = parsed.data

    // Plan limit check
    const limit = await checkLeadSearchLimit(workspaceId)
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            limit.max === 0
              ? 'Lead research is a Pro feature. Upgrade to Pro or Scale to use it.'
              : `You've used all ${limit.max} lead searches this month. Resets on the 1st.`,
          used: limit.used,
          max: limit.max,
        },
        { status: 403 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY || !process.env.APIFY_TOKEN) {
      return NextResponse.json(
        { error: 'Lead research is not fully configured yet — needs ANTHROPIC_API_KEY and APIFY_TOKEN.' },
        { status: 503 }
      )
    }

    // Create pending row up-front so we never lose track of a search in flight
    const service = createServiceClient()
    const { data: inserted, error: insErr } = await service
      .from('lead_searches')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        query,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insErr || !inserted) {
      console.error('POST /api/coach/leads/search insert', insErr)
      return NextResponse.json({ error: 'Could not start search' }, { status: 500 })
    }
    const searchId = inserted.id as string

    // Run the actual Claude search
    try {
      const outcome = await runLeadResearch(query, {
        discipline: parsed.data.discipline ?? null,
        area: parsed.data.area ?? null,
        idealClients: parsed.data.idealClients ?? null,
        platform: parsed.data.platform ?? null,
      })
      const status = outcome.results.length > 0 ? 'done' : 'failed'
      const errorMessage = outcome.results.length === 0
        ? 'No usable results returned — try rewording the query.'
        : null

      const { data: updated } = await service
        .from('lead_searches')
        .update({
          status,
          results: outcome.results,
          result_count: outcome.results.length,
          cost_cents: outcome.costCents,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', searchId)
        .select('id, query, status, results, result_count, cost_cents, error_message, created_at, completed_at')
        .single()

      // Return current limit state too so UI can update the counter
      const newLimit = await checkLeadSearchLimit(workspaceId)
      return NextResponse.json({
        data: { search: updated, limit: newLimit },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await service
        .from('lead_searches')
        .update({
          status: 'failed',
          error_message: message.slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq('id', searchId)
      if (err instanceof LeadSearchUnavailableError) {
        // Founder-visible, greppable in Vercel logs / alerting.
        console.error('[LEAD_SEARCH_UNAVAILABLE]', err.reason, err.message)
        return NextResponse.json(
          { error: "Lead search is temporarily unavailable — we've been notified. No search was used." },
          { status: 503 }
        )
      }
      console.error('POST /api/coach/leads/search runLeadResearch', err)
      return NextResponse.json({ error: 'Search failed — try again' }, { status: 502 })
    }
  } catch (err) {
    console.error('POST /api/coach/leads/search', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
