import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { classifyAuditCategory } from '@/lib/admin-audit-messages'
import { createServiceClient } from '@/lib/supabase/service'

const PAGE_SIZE = 50

const CATEGORY_ACTIONS: Record<string, 'admin_prefix' | string[] | 'all'> = {
  all: 'all',
  security: ['login', 'login_failed', 'suspicious_request'],
  payments: ['invoice_paid', 'subscription_changed'],
  data: ['client_invited', 'client_deleted', 'password_changed', 'file_uploaded'],
  admin: 'admin_prefix',
}

function escapeIlike(s: string): string {
  return s.replace(/[%_]/g, '\\$&')
}

type AuditRow = {
  id: string
  action: string
  user_id: string | null
  workspace_id: string | null
  ip_address: string | null
  created_at: string
  metadata: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAuditFilters(q: any, options: FilterOptions) {
  let query = q
  const { actionFilter, from, to, workspaceId, category, q: searchQ, profileIdsForQ } = options

  if (actionFilter) {
    query = query.ilike('action', `%${escapeIlike(actionFilter)}%`)
  }
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const cat = CATEGORY_ACTIONS[category] ?? 'all'
  if (cat === 'admin_prefix') {
    query = query.like('action', 'admin.%')
  } else if (Array.isArray(cat) && cat.length > 0) {
    query = query.in('action', cat)
  }

  if (searchQ) {
    const like = `%${escapeIlike(searchQ)}%`
    if (profileIdsForQ && profileIdsForQ.length > 0) {
      const ids = profileIdsForQ.slice(0, 40)
      const orParts = [`ip_address.ilike.${like}`, ...ids.map((id) => `user_id.eq.${id}`)]
      query = query.or(orParts.join(','))
    } else {
      query = query.ilike('ip_address', like)
    }
  }

  return query
}

type FilterOptions = {
  actionFilter: string
  from: string | null
  to: string | null
  workspaceId: string
  category: string
  q: string
  profileIdsForQ: string[] | null
}

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()
    const { searchParams } = new URL(request.url)
    const actionFilter = (searchParams.get('action') ?? '').trim()
    const emailFilter = (searchParams.get('email') ?? '').trim().toLowerCase()
    const qParam = (searchParams.get('q') ?? '').trim()
    const category = (searchParams.get('category') ?? 'all').trim().toLowerCase()
    const workspaceId = (searchParams.get('workspace_id') ?? '').trim()
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let profileIdsForQ: string[] | null = null
    if (qParam) {
      const { data: profs } = await service
        .from('profiles')
        .select('id')
        .ilike('email', `%${escapeIlike(qParam)}%`)
      profileIdsForQ = (profs ?? []).map((p) => p.id as string)
    }

    const filterOpts: FilterOptions = {
      actionFilter,
      from,
      to,
      workspaceId,
      category,
      q: qParam,
      profileIdsForQ,
    }

    let countBuilder = service.from('audit_logs').select('id', { count: 'exact', head: true })
    countBuilder = applyAuditFilters(countBuilder, filterOpts)
    const { count: totalCount, error: countError } = await countBuilder
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

    const fromIdx = (page - 1) * PAGE_SIZE
    const toIdx = fromIdx + PAGE_SIZE - 1
    let dataBuilder = service
      .from('audit_logs')
      .select('id,action,user_id,workspace_id,ip_address,created_at,metadata')
    dataBuilder = applyAuditFilters(dataBuilder, filterOpts)
    const { data: logs, error } = await dataBuilder
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (logs ?? []) as AuditRow[]
    const userIds = [...new Set(rows.map((l) => l.user_id).filter(Boolean))] as string[]
    const { data: profiles } =
      userIds.length > 0
        ? await service.from('profiles').select('id,email,full_name').in('id', userIds)
        : { data: [] }
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

    const workspaceIds = [...new Set(rows.map((l) => l.workspace_id).filter(Boolean))] as string[]
    const { data: workspaces } =
      workspaceIds.length > 0
        ? await service.from('workspaces').select('id,name').in('id', workspaceIds)
        : { data: [] }
    const wsName = new Map((workspaces ?? []).map((w) => [w.id, w.name ?? '']))

    let mapped = rows.map((l) => {
      const prof = l.user_id ? profileById.get(l.user_id) : undefined
      return {
        id: l.id,
        action: l.action,
        userId: l.user_id,
        userEmail: prof?.email ?? '',
        userName: prof?.full_name ?? '',
        workspaceId: l.workspace_id,
        workspaceName: l.workspace_id ? wsName.get(l.workspace_id as string) ?? '' : '',
        ip: l.ip_address,
        time: l.created_at,
        metadata: (l.metadata as Record<string, unknown>) ?? {},
        category: classifyAuditCategory(l.action),
      }
    })

    if (emailFilter && !qParam) {
      mapped = mapped.filter((r) => r.userEmail.toLowerCase().includes(emailFilter))
    }

    await logAdminAudit({
      action: 'admin.audit.read',
      userId: auth.id,
      request,
      metadata: { returned: mapped.length, page, category },
    })

    return NextResponse.json({
      data: {
        events: mapped,
        page,
        pageSize: PAGE_SIZE,
        total: totalCount ?? mapped.length,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load audit log' }, { status: 500 })
  }
}
