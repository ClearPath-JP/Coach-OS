import { NextResponse } from 'next/server'
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { requireCoach } from '@/lib/api-helpers'
import { trendFromCounts } from '@/lib/dashboard-trends'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { computePaymentSummary } from '@/lib/payments-summary'
import { getSummaryRange } from '@/lib/payment-period'

/**
 * GET /api/coach/dashboard-summary — counts, revenue, and WoW/MoM trends for coach dashboard.
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

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const prevWeekStart = subWeeks(weekStart, 1)
    const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 })

    const last7Start = subDays(now, 7)
    const prev7Start = subDays(now, 14)

    const thisMonthRange = getSummaryRange('month')
    const prevMonthAnchor = subMonths(now, 1)
    const prevMonthRange = { start: startOfMonth(prevMonthAnchor), end: endOfMonth(prevMonthAnchor) }

    const monthStart = startOfMonth(now)

    const [
      activeClientsRes,
      sessionsWeekRes,
      sessionsPrevWeekRes,
      pendingInvoicesRes,
      clientsNewLast7Res,
      clientsNewPrev7Res,
      messagesLast7Res,
      messagesPrev7Res,
      clientsAddedThisMonthRes,
      coachMessagesSentRes,
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
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('coach_id', user.id)
        .gte('scheduled_time', prevWeekStart.toISOString())
        .lte('scheduled_time', prevWeekEnd.toISOString())
        .in('status', ['pending', 'confirmed']),
      supabase
        .from('session_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending'),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', last7Start.toISOString()),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', prev7Start.toISOString())
        .lt('created_at', last7Start.toISOString()),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .gte('created_at', last7Start.toISOString()),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .gte('created_at', prev7Start.toISOString())
        .lt('created_at', last7Start.toISOString()),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('sender_id', user.id),
    ])

    let revenueMonth = 0
    let revenuePrevMonth = 0
    try {
      const summaryNow = await computePaymentSummary(supabase, workspaceId, thisMonthRange)
      revenueMonth = summaryNow.totalRevenue ?? 0
    } catch {
      revenueMonth = 0
    }
    try {
      const summaryPrev = await computePaymentSummary(supabase, workspaceId, prevMonthRange)
      revenuePrevMonth = summaryPrev.totalRevenue ?? 0
    } catch {
      revenuePrevMonth = 0
    }

    const sessionsThisWeek = sessionsWeekRes.count ?? 0
    const sessionsPrevWeek = sessionsPrevWeekRes.count ?? 0
    const clientsNewLast7 = clientsNewLast7Res.count ?? 0
    const clientsNewPrev7 = clientsNewPrev7Res.count ?? 0
    const messagesLast7 = messagesLast7Res.count ?? 0
    const messagesPrev7 = messagesPrev7Res.count ?? 0

    const trends = {
      /** New clients added in trailing 7d vs previous 7d (roster momentum). */
      activeClients: trendFromCounts(clientsNewLast7, clientsNewPrev7),
      sessionsThisWeek: trendFromCounts(sessionsThisWeek, sessionsPrevWeek),
      revenueMonth: trendFromCounts(revenueMonth, revenuePrevMonth),
      /** Inbound messages to coach in trailing 7d vs previous 7d (engagement proxy for unread tile). */
      messagesToCoach: trendFromCounts(messagesLast7, messagesPrev7),
    }

    const res = NextResponse.json({
      data: {
        activeClientsCount: activeClientsRes.count ?? 0,
        sessionsThisWeek,
        revenueMonthCents: revenueMonth,
        /** Same calendar-month window as `revenueMonthCents`, previous month (for MoM subtitle on dashboard). */
        revenuePrevMonthCents: revenuePrevMonth,
        pendingInvoicesCount: pendingInvoicesRes.count ?? 0,
        /** Clients created in the current calendar month (any status). */
        clientsAddedThisMonth: clientsAddedThisMonthRes.count ?? 0,
        /** Outbound messages sent by this coach in the workspace (onboarding checklist). */
        coachMessagesSentCount: coachMessagesSentRes.count ?? 0,
        trends,
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    console.error('GET /api/coach/dashboard-summary', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
