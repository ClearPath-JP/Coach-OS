import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { PLAN_MRR_CENTS } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()

    const [subsRes, workspacesRes, coachesRes, profilesRes, auditRaw] = await Promise.all([
      service
        .from('subscriptions')
        .select('id,workspace_id,plan,status,created_at,current_period_end,stripe_customer_id,stripe_subscription_id')
        .order('created_at', { ascending: false }),
      service.from('workspaces').select('id,name'),
      service.from('coaches').select('workspace_id,user_id,role'),
      service.from('profiles').select('id,email,full_name'),
      service.from('audit_logs').select('action,user_id,workspace_id,ip_address,created_at,metadata').limit(200),
    ])

    const auditRes = (auditRaw.data ?? [])
      .filter((a) => a.action.toLowerCase().includes('subscription'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    const wsById = new Map((workspacesRes.data ?? []).map((w) => [w.id, w.name ?? 'Workspace']))
    const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
    const coachEmailByWs = new Map<string, string>()
    for (const c of coachesRes.data ?? []) {
      const p = profilesById.get(c.user_id)
      if (!p?.email) continue
      const wid = String(c.workspace_id)
      if (c.role === 'owner' || !coachEmailByWs.has(wid)) coachEmailByWs.set(wid, p.email)
    }

    const mrrByPlan: Record<string, { coaches: number; mrrCents: number }> = {
      free: { coaches: 0, mrrCents: 0 },
      founding: { coaches: 0, mrrCents: 0 },
      starter: { coaches: 0, mrrCents: 0 },
      pro: { coaches: 0, mrrCents: 0 },
      scale: { coaches: 0, mrrCents: 0 },
    }

    const seen = new Set<string>()
    for (const s of subsRes.data ?? []) {
      if (s.status !== 'active' && s.status !== 'trialing') continue
      const wid = String(s.workspace_id)
      if (seen.has(wid)) continue
      seen.add(wid)
      const plan = s.plan ?? 'free'
      if (!mrrByPlan[plan]) continue
      mrrByPlan[plan].coaches += 1
      mrrByPlan[plan].mrrCents += PLAN_MRR_CENTS[plan] ?? 0
    }

    const totalMrrCents = Object.values(mrrByPlan).reduce((s, p) => s + p.mrrCents, 0)

    const rows = (subsRes.data ?? []).map((s) => ({
      workspaceId: s.workspace_id,
      workspaceName: wsById.get(s.workspace_id) ?? '—',
      coachEmail: coachEmailByWs.get(String(s.workspace_id)) ?? '—',
      plan: s.plan ?? 'free',
      status: s.status ?? 'active',
      started: s.created_at,
      periodEnd: s.current_period_end,
      stripeCustomerId: s.stripe_customer_id,
      stripeSubscriptionId: s.stripe_subscription_id,
    }))

    await logAdminAudit({
      action: 'admin.subscriptions.read',
      userId: auth.id,
      request,
      metadata: { count: rows.length },
    })

    return NextResponse.json({
      data: {
        mrrByPlan,
        totalMrrCents,
        totalArrCents: totalMrrCents * 12,
        subscriptions: rows,
        recentChanges: auditRes,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load subscriptions' }, { status: 500 })
  }
}
