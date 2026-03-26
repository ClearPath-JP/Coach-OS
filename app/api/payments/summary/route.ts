import { NextResponse } from 'next/server'
import { paymentsSummaryCacheKey, withCache } from '@/lib/api-cache'
import { createClient } from '@/lib/supabase-server'
import { computePaymentSummary } from '@/lib/payments-summary'
import { getSummaryRange, type SummaryPeriod } from '@/lib/payment-period'

/**
 * GET /api/payments/summary — aggregates for workspace. Coach only.
 * Query: period=week|month|year|all, startDate=, endDate= (optional overrides)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('period')?.trim() ?? 'month'
    const period: SummaryPeriod = ['week', 'month', 'year', 'all'].includes(raw)
      ? (raw as SummaryPeriod)
      : 'month'
    const startDate = searchParams.get('startDate')?.trim()
    const endDate = searchParams.get('endDate')?.trim()
    const clientIdParam = searchParams.get('clientId')?.trim()

    const ws = coach.workspace_id
    const cacheKey = paymentsSummaryCacheKey(ws, period, startDate ?? '', endDate ?? '', clientIdParam ?? '')
    const summary = await withCache(cacheKey, 300, async () => {
      const range = getSummaryRange(period, startDate, endDate)
      return computePaymentSummary(
        supabase,
        ws,
        range,
        clientIdParam ? { clientId: clientIdParam } : undefined
      )
    })

    return NextResponse.json({ data: summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
