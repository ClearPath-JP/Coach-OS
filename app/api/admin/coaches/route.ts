import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { effectiveClientLimit } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'

function monthStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()
    const planFilter = (searchParams.get('plan') ?? '').trim().toLowerCase()
    const statusFilter = (searchParams.get('status') ?? '').trim().toLowerCase()
    const monthStart = monthStartIso()

    const [workspacesRes, coachesRes, subsRes, profilesRes, clientsRes, paymentsMonthRes, sessionsRes] =
      await Promise.all([
        service
          .from('workspaces')
          .select('id,name,created_at,status,max_clients,max_video_storage_gb,storage_used_bytes'),
        service.from('coaches').select('workspace_id,user_id,created_at'),
        service.from('subscriptions').select('workspace_id,plan,status,current_period_end,stripe_customer_id,trial_ends_at'),
        service.from('profiles').select('id,email,full_name,updated_at'),
        service.from('clients').select('workspace_id,id'),
        service.from('payments').select('workspace_id,amount_cents').gte('payment_date', monthStart),
        service.from('sessions').select('workspace_id,id'),
      ])

    const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
    const subsByWorkspace = new Map((subsRes.data ?? []).map((s) => [s.workspace_id, s]))
    const clientCountByWorkspace = new Map<string, number>()
    for (const c of clientsRes.data ?? []) {
      clientCountByWorkspace.set(c.workspace_id, (clientCountByWorkspace.get(c.workspace_id) ?? 0) + 1)
    }

    const revenueByWorkspace = new Map<string, number>()
    for (const p of paymentsMonthRes.data ?? []) {
      const wid = p.workspace_id as string
      revenueByWorkspace.set(wid, (revenueByWorkspace.get(wid) ?? 0) + (p.amount_cents ?? 0))
    }

    const sessionsByWorkspace = new Map<string, number>()
    for (const s of sessionsRes.data ?? []) {
      const wid = s.workspace_id as string
      sessionsByWorkspace.set(wid, (sessionsByWorkspace.get(wid) ?? 0) + 1)
    }

    let rows = (workspacesRes.data ?? []).map((w) => {
      const coach = (coachesRes.data ?? []).find((c) => c.workspace_id === w.id)
      const profile = coach ? profilesById.get(coach.user_id) : null
      const sub = subsByWorkspace.get(w.id)
      const plan = sub?.plan ?? 'free'
      const clients = clientCountByWorkspace.get(w.id) ?? 0
      const maxClients = effectiveClientLimit(plan, w.max_clients)
      const workspaceStatus = (w as { status?: string }).status ?? 'active'
      const subStatus = sub?.status ?? 'active'
      const displayStatus =
        workspaceStatus === 'suspended'
          ? 'suspended'
          : subStatus === 'trialing' || (sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date())
            ? 'trial'
            : subStatus === 'past_due'
              ? 'past_due'
              : subStatus === 'cancelled'
                ? 'cancelled'
                : 'active'
      const wExtra = w as { storage_used_bytes?: number; max_video_storage_gb?: number }
      return {
        workspaceId: w.id,
        workspaceName: w.name ?? 'Untitled workspace',
        coachName: profile?.full_name ?? 'Coach',
        email: profile?.email ?? '—',
        plan,
        status: displayStatus,
        workspaceStatus,
        subscriptionStatus: subStatus,
        clients,
        maxClients,
        lastActiveAt: profile?.updated_at ?? null,
        joined: coach?.created_at ?? w.created_at,
        revenueThisMonthCents: revenueByWorkspace.get(w.id) ?? 0,
        sessionsCount: sessionsByWorkspace.get(w.id) ?? 0,
        storageUsedBytes: Number(wExtra.storage_used_bytes ?? 0),
        maxVideoStorageGb: Number(wExtra.max_video_storage_gb ?? 5),
      }
    })

    if (planFilter) {
      if (planFilter === 'free') rows = rows.filter((r) => r.plan === 'free')
      else rows = rows.filter((r) => r.plan === planFilter)
    }
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter || r.workspaceStatus === statusFilter)
    if (search) {
      rows = rows.filter((r) =>
        `${r.workspaceName} ${r.email}`.toLowerCase().includes(search)
      )
    }

    await logAdminAudit({
      action: 'admin.coaches.read',
      userId: auth.id,
      request,
      metadata: { total: rows.length, planFilter, search, statusFilter },
    })

    return NextResponse.json({ data: rows })
  } catch {
    return NextResponse.json({ error: 'Could not load coaches' }, { status: 500 })
  }
}
