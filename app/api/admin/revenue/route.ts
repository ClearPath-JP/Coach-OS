import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { PLAN_MRR_CENTS } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'

function monthKeysLast6(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 5; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const y = x.getFullYear()
    const m = String(x.getMonth() + 1).padStart(2, '0')
    out.push(`${y}-${m}`)
  }
  return out
}

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()

    const keys = monthKeysLast6()
    const startDate = `${keys[0]}-01`

    const [paymentsRes, subsRes, coachesRes, profilesRes] = await Promise.all([
      service
        .from('payments')
        .select('workspace_id,amount_cents,payment_method,payment_date,client_id')
        .gte('payment_date', startDate)
        .order('payment_date', { ascending: false }),
      service.from('subscriptions').select('workspace_id,plan,status,created_at').order('created_at', { ascending: false }),
      service.from('coaches').select('workspace_id,user_id,role'),
      service.from('profiles').select('id,email,full_name'),
    ])

    const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
    const coachEmailByWs = new Map<string, string>()
    for (const c of coachesRes.data ?? []) {
      const p = profilesById.get(c.user_id)
      if (!p?.email) continue
      const wid = String(c.workspace_id)
      if (c.role === 'owner' || !coachEmailByWs.has(wid)) coachEmailByWs.set(wid, p.email)
    }

    const byPlan: Record<string, { coaches: number; mrrCents: number }> = {
      free: { coaches: 0, mrrCents: 0 },
      founding: { coaches: 0, mrrCents: 0 },
      starter: { coaches: 0, mrrCents: 0 },
      pro: { coaches: 0, mrrCents: 0 },
      scale: { coaches: 0, mrrCents: 0 },
    }
    const counted = new Set<string>()
    for (const s of subsRes.data ?? []) {
      if (s.status !== 'active' && s.status !== 'trialing') continue
      const wid = String(s.workspace_id)
      if (counted.has(wid)) continue
      counted.add(wid)
      const plan = s.plan ?? 'free'
      if (!byPlan[plan]) continue
      byPlan[plan].coaches += 1
      byPlan[plan].mrrCents += PLAN_MRR_CENTS[plan] ?? 0
    }
    const totalMrrCents = Object.values(byPlan).reduce((sum, p) => sum + p.mrrCents, 0)

    const monthlyTotals = new Map<string, number>()
    for (const k of keys) monthlyTotals.set(k, 0)
    const methodTotals = new Map<string, { count: number; cents: number }>()

    const clientIds = [...new Set((paymentsRes.data ?? []).map((p) => p.client_id).filter(Boolean))] as string[]
    const { data: clientRows } =
      clientIds.length > 0
        ? await service.from('clients').select('id,first_name,last_name,email').in('id', clientIds)
        : { data: [] }
    const clientLabel = new Map(
      (clientRows ?? []).map((c) => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Client'
        return [c.id, `${name}${c.email ? ` (${c.email})` : ''}`]
      })
    )

    for (const p of paymentsRes.data ?? []) {
      const pd = p.payment_date ?? ''
      const ym = pd.slice(0, 7)
      if (monthlyTotals.has(ym)) {
        monthlyTotals.set(ym, (monthlyTotals.get(ym) ?? 0) + (p.amount_cents ?? 0))
      }
      const m = p.payment_method ?? 'other'
      const cur = methodTotals.get(m) ?? { count: 0, cents: 0 }
      cur.count += 1
      cur.cents += p.amount_cents ?? 0
      methodTotals.set(m, cur)
    }

    const monthlyLast6 = keys.map((k) => ({
      month: k,
      label: new Date(`${k}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      totalCents: monthlyTotals.get(k) ?? 0,
    }))

    const methodTotalCents = [...methodTotals.values()].reduce((s, v) => s + v.cents, 0)
    const methodBreakdown = [...methodTotals.entries()].map(([method, v]) => ({
      method,
      count: v.count,
      cents: v.cents,
      percent: methodTotalCents > 0 ? Math.round((v.cents / methodTotalCents) * 1000) / 10 : 0,
    }))

    const recentPayments = (paymentsRes.data ?? []).slice(0, 20).map((p) => ({
      coach: coachEmailByWs.get(String(p.workspace_id)) ?? '—',
      client: p.client_id ? clientLabel.get(p.client_id) ?? '—' : '—',
      amountCents: p.amount_cents ?? 0,
      method: p.payment_method ?? '—',
      date: p.payment_date ?? '',
    }))

    const recent = (subsRes.data ?? []).slice(0, 20)
    const recentSubsList = recent.map((s) => ({
      coach: coachEmailByWs.get(String(s.workspace_id)) ?? '—',
      plan: s.plan ?? 'free',
      status: s.status ?? 'active',
      created_at: s.created_at,
    }))

    await logAdminAudit({
      action: 'admin.revenue.read',
      userId: auth.id,
      request,
      metadata: { payments: paymentsRes.data?.length ?? 0 },
    })

    return NextResponse.json({
      data: {
        byPlan,
        totalMrrCents,
        totalArrCents: totalMrrCents * 12,
        monthlyLast6,
        methodBreakdown,
        recentPayments,
        recentSubscriptions: recentSubsList,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load revenue' }, { status: 500 })
  }
}
