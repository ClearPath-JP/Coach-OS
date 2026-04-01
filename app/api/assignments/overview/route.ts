import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/assignments/overview — dashboard aggregates (coach).
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-overview:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const nowIso = new Date().toISOString()

    const { count: pendingReview } = await supabase
      .from('client_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'submitted')

    const { data: overdueRows } = await supabase
      .from('client_assignments')
      .select('id, due_at, status')
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'returned'])
      .not('due_at', 'is', null)
      .lt('due_at', nowIso)

    const overdueCount = overdueRows?.length ?? 0

    const { data: allRows } = await supabase
      .from('client_assignments')
      .select('id, status')
      .eq('workspace_id', workspaceId)

    const total = allRows?.length ?? 0
    const approved = (allRows ?? []).filter((r) => r.status === 'approved').length
    const completionRatePct = total > 0 ? Math.round((approved / total) * 100) : 0

    const { data: topRewards } = await supabase
      .from('client_rewards')
      .select('client_id, total_xp, level, clients(first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .order('total_xp', { ascending: false })
      .limit(5)

    const topClients = (topRewards ?? []).map((r) => {
      const rawC = r.clients as unknown
      const cRow = Array.isArray(rawC) ? rawC[0] : rawC
      const c =
        cRow && typeof cRow === 'object'
          ? (cRow as { first_name: string | null; last_name: string | null })
          : null
      const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Client'
      return { clientId: r.client_id, name, totalXp: r.total_xp ?? 0, level: r.level ?? 1 }
    })

    return NextResponse.json({
      data: {
        pendingReviewCount: pendingReview ?? 0,
        overdueCount,
        completionRatePct,
        topClientsByXp: topClients,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
