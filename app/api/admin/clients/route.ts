import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

type ClientRow = {
  workspaceId: string
  workspaceName: string
  coachEmail: string
  clientName: string
  email: string | null
  status: string
  plan: string
  joined: string
}

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth

    const service = createServiceClient()
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()

    const [clientsRes, workspacesRes, coachesRes, subsRes] = await Promise.all([
      service
        .from('clients')
        .select('id,workspace_id,first_name,last_name,email,status,created_at')
        .order('created_at', { ascending: false }),
      service.from('workspaces').select('id,name'),
      service.from('coaches').select('workspace_id,user_id,role'),
      service.from('subscriptions').select('workspace_id,plan').eq('status', 'active'),
    ])

    // Fetch only the profiles we actually need.
    const coachUserIds = [...new Set((coachesRes.data ?? []).map((c) => c.user_id).filter(Boolean))]
    const { data: neededProfiles } =
      coachUserIds.length > 0
        ? await service.from('profiles').select('id,email,full_name').in('id', coachUserIds)
        : { data: [] }

    const workspacesById = new Map((workspacesRes.data ?? []).map((w) => [w.id, w]))
    const profilesById = new Map((neededProfiles ?? []).map((p) => [p.id, p]))
    const subsByWorkspace = new Map<string, string>(
      (subsRes.data ?? []).map((s) => [String(s.workspace_id), s.plan ?? 'free'])
    )

    const coachEmailByWorkspace = new Map<string, string>()
    for (const c of coachesRes.data ?? []) {
      const wid = String(c.workspace_id)
      const p = profilesById.get(c.user_id)
      if (!p?.email) continue
      // Prefer workspace owner if we can.
      const existing = coachEmailByWorkspace.get(wid)
      if (!existing || c.role === 'owner') coachEmailByWorkspace.set(wid, p.email)
    }

    let rows: ClientRow[] = (clientsRes.data ?? []).map((cl) => {
      const workspaceId = String(cl.workspace_id)
      const workspaceName = workspacesById.get(cl.workspace_id)?.name ?? 'Untitled workspace'
      const coachEmail = coachEmailByWorkspace.get(workspaceId) ?? '—'
      const first = cl.first_name ?? ''
      const last = cl.last_name ?? ''
      const clientName = [first, last].filter(Boolean).join(' ').trim() || 'Client'
      return {
        workspaceId,
        workspaceName,
        coachEmail,
        clientName,
        email: cl.email ?? null,
        status: cl.status,
        plan: subsByWorkspace.get(workspaceId) ?? 'free',
        joined: cl.created_at,
      }
    })

    if (search) {
      rows = rows.filter((r) =>
        `${r.workspaceName} ${r.coachEmail} ${r.clientName} ${r.email ?? ''}`.toLowerCase().includes(search)
      )
    }

    await logAdminAudit({
      action: 'admin.clients.read',
      userId: auth.id,
      request,
      metadata: { total: rows.length, search: search || null },
    })

    return NextResponse.json({ data: rows })
  } catch {
    return NextResponse.json({ error: 'Could not load clients' }, { status: 500 })
  }
}

