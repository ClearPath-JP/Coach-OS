import { NextResponse } from 'next/server'
import { endOfWeek, startOfWeek } from 'date-fns'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { computePaymentSummary } from '@/lib/payments-summary'
import { getSummaryRange } from '@/lib/payment-period'

/**
 * GET /api/coach/dashboard-summary — counts and revenue for coach dashboard. Coach only.
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`coach-dashboard-summary:${user.id}`, {
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

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

    const [
      activeClientsRes,
      sessionsWeekRes,
      pendingInvoicesRes,
    ] = await Promise.all([
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
      supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('coach_id', user.id)
        .gte('scheduled_time', weekStart.toISOString())
        .lte('scheduled_time', weekEnd.toISOString())
        .in('status', ['pending', 'confirmed']),
      supabase
        .from('session_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending'),
    ])

    let revenueMonth = 0
    try {
      const range = getSummaryRange('month')
      const summary = await computePaymentSummary(supabase, workspaceId, range)
      revenueMonth = summary.totalRevenue ?? 0
    } catch {
      revenueMonth = 0
    }

    const res = NextResponse.json({
      data: {
        activeClientsCount: activeClientsRes.count ?? 0,
        sessionsThisWeek: sessionsWeekRes.count ?? 0,
        revenueMonthCents: revenueMonth,
        pendingInvoicesCount: pendingInvoicesRes.count ?? 0,
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
