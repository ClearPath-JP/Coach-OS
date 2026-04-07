import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { effectiveClientLimit } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'

const patchBodySchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'scale']).optional(),
  status: z.enum(['active', 'trialing', 'past_due', 'cancelled', 'paused']).optional(),
  workspaceStatus: z.enum(['active', 'suspended']).optional(),
  resetToFree: z.boolean().optional(),
  adminNotes: z.string().max(10000).optional(),
})

function monthStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

type Ctx = { params: Promise<{ workspaceId: string }> }

export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = await context.params
    const service = createServiceClient()

    const monthStart = monthStartIso()
    const [
      workspaceRes,
      coachRes,
      subRes,
      clientsRes,
      messagesCountRes,
      sessionsCountRes,
      programsCountRes,
      videosCountRes,
      sessionsMonthCountRes,
      sessionsClientRowsRes,
      clientProgramsRowsRes,
      auditRes,
    ] = await Promise.all([
      service
        .from('workspaces')
        .select('id,name,status,created_at,owner_id,max_clients,max_video_storage_gb,storage_used_bytes,admin_notes')
        .eq('id', workspaceId)
        .maybeSingle(),
      service.from('coaches').select('user_id,created_at').eq('workspace_id', workspaceId).maybeSingle(),
      service
        .from('subscriptions')
        .select('plan,status,current_period_end,stripe_customer_id,trial_ends_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      service
        .from('clients')
        .select('id,first_name,last_name,email,status,created_at,updated_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      service.from('messages').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      service.from('sessions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      service.from('programs').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      service.from('videos').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      service
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', monthStart),
      service.from('sessions').select('client_id').eq('workspace_id', workspaceId),
      service.from('client_programs').select('client_id,program_id').eq('workspace_id', workspaceId),
      service
        .from('audit_logs')
        .select('action,user_id,ip_address,created_at,metadata')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (!workspaceRes.data) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const coachUserId = coachRes.data?.user_id
    const coachProfile = coachUserId
      ? await service
          .from('profiles')
          .select('id,email,full_name,created_at,updated_at,logo_url')
          .eq('id', coachUserId)
          .maybeSingle()
      : { data: null }

    let lastLoginAt: string | null = null
    if (coachUserId) {
      const { data: loginRow } = await service
        .from('audit_logs')
        .select('created_at')
        .eq('user_id', coachUserId)
        .eq('action', 'login')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastLoginAt = loginRow?.created_at ?? null
    }

    await logAdminAudit({
      action: 'admin.coach.detail.read',
      userId: auth.id,
      workspaceId,
      request,
    })

    const sessionsCountByClientId = new Map<string, number>()
    for (const row of sessionsClientRowsRes.data ?? []) {
      const cid = row.client_id
      if (!cid) continue
      const key = String(cid)
      sessionsCountByClientId.set(key, (sessionsCountByClientId.get(key) ?? 0) + 1)
    }

    const programIds = [...new Set((clientProgramsRowsRes.data ?? []).map((r) => r.program_id).filter(Boolean))] as string[]
    const { data: programRows } =
      programIds.length > 0
        ? await service.from('programs').select('id,name').in('id', programIds)
        : { data: [] as { id: string; name: string }[] }
    const programNameById = new Map((programRows ?? []).map((p) => [p.id, p.name ?? 'Program']))

    const programsCountByClientId = new Map<string, number>()
    const programNameByClientId = new Map<string, string>()
    for (const row of clientProgramsRowsRes.data ?? []) {
      const cid = row.client_id
      if (!cid) continue
      const key = String(cid)
      programsCountByClientId.set(key, (programsCountByClientId.get(key) ?? 0) + 1)
      if (!programNameByClientId.has(key)) {
        const n = programNameById.get(row.program_id as string)
        if (n) programNameByClientId.set(key, n)
      }
    }

    const w = workspaceRes.data
    const plan = subRes.data?.plan ?? 'free'
    const clientLimit = effectiveClientLimit(plan, w.max_clients)
    const wRow = w as { storage_used_bytes?: number; admin_notes?: string | null }
    const storageUsedBytes = Number(wRow.storage_used_bytes ?? 0)
    const storageLimitGb = w.max_video_storage_gb ?? 5

    const auditRows = auditRes.data ?? []
    const auditUserIds = [...new Set(auditRows.map((a) => a.user_id).filter(Boolean))] as string[]
    const { data: auditProfiles } =
      auditUserIds.length > 0
        ? await service.from('profiles').select('id,email,full_name').in('id', auditUserIds)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] }
    const auditProfById = new Map((auditProfiles ?? []).map((p) => [p.id, p]))

    return NextResponse.json({
      data: {
        workspace: w,
        adminNotes: wRow.admin_notes ?? '',
        coach: coachProfile.data,
        coachJoinedAt: coachRes.data?.created_at ?? null,
        lastLoginAt,
        subscription: subRes.data,
        clients: (clientsRes.data ?? []).map((c) => ({
          ...c,
          sessions: sessionsCountByClientId.get(String(c.id)) ?? 0,
          programs: programsCountByClientId.get(String(c.id)) ?? 0,
          programName: programNameByClientId.get(String(c.id)) ?? null,
        })),
        usage: {
          messages: messagesCountRes.count ?? 0,
          sessions: sessionsCountRes.count ?? 0,
          sessionsThisMonth: sessionsMonthCountRes.count ?? 0,
          programs: programsCountRes.count ?? 0,
          videos: videosCountRes.count ?? 0,
          clients: (clientsRes.data ?? []).length,
          clientLimit,
          storageUsedBytes,
          storageLimitGb,
        },
        recentAudit: auditRows.map((a) => {
          const prof = a.user_id ? auditProfById.get(a.user_id) : undefined
          return {
            action: a.action,
            user_id: a.user_id,
            actorName: prof?.full_name ?? null,
            actorEmail: prof?.email ?? null,
            ip_address: a.ip_address,
            created_at: a.created_at,
            metadata: a.metadata,
          }
        }),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load workspace detail' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = await context.params

    const rawBody = await request.json().catch(() => ({}))
    const parsed = patchBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const body = parsed.data

    const service = createServiceClient()

    if (typeof body.adminNotes === 'string') {
      await service.from('workspaces').update({ admin_notes: body.adminNotes }).eq('id', workspaceId)
    }

    if (body.resetToFree) {
      const { data: existing } = await service
        .from('subscriptions')
        .select('workspace_id')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (existing) {
        await service
          .from('subscriptions')
          .update({ plan: 'free', status: 'active' })
          .eq('workspace_id', workspaceId)
      } else {
        await service.from('subscriptions').insert({
          workspace_id: workspaceId,
          plan: 'free',
          status: 'active',
        })
      }
    }

    if (body.plan || body.status) {
      const patch: Record<string, unknown> = {}
      if (body.plan) patch.plan = body.plan
      if (body.status) patch.status = body.status
      const { data: existing } = await service
        .from('subscriptions')
        .select('workspace_id')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (existing) {
        await service.from('subscriptions').update(patch).eq('workspace_id', workspaceId)
      } else {
        await service.from('subscriptions').insert({
          workspace_id: workspaceId,
          plan: body.plan ?? 'free',
          status: body.status ?? 'active',
        })
      }
    }

    if (body.workspaceStatus) {
      await service.from('workspaces').update({ status: body.workspaceStatus }).eq('id', workspaceId)
    }

    await logAdminAudit({
      action: 'admin.coach.detail.patch',
      userId: auth.id,
      workspaceId,
      request,
      metadata: body,
    })

    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Could not update workspace' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = await context.params
    const service = createServiceClient()

    const { data: ws } = await service.from('workspaces').select('id,name').eq('id', workspaceId).maybeSingle()
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { error } = await service.from('workspaces').delete().eq('id', workspaceId)
    if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })

    await logAdminAudit({
      action: 'admin.workspace.delete',
      userId: auth.id,
      workspaceId,
      request,
      metadata: { workspaceName: ws.name },
    })

    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Could not delete workspace' }, { status: 500 })
  }
}
