import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(300, Math.max(1, Number(searchParams.get('limit') ?? '100') || 100))
    const roleFilter = (searchParams.get('role') ?? '').trim()

    let q = service
      .from('frontend_error_logs')
      .select(
        'id,workspace_id,user_id,user_email,role,route_path,error_message,error_stack,component_stack,client_meta,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (roleFilter === 'coach' || roleFilter === 'client') {
      q = q.eq('role', roleFilter)
    }

    const { data: rows, error } = await q
    if (error) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    const workspaceIds = [...new Set((rows ?? []).map((r) => r.workspace_id).filter(Boolean))] as string[]
    const { data: workspaces } =
      workspaceIds.length > 0
        ? await service.from('workspaces').select('id,name').in('id', workspaceIds)
        : { data: [] }
    const wsName = new Map((workspaces ?? []).map((w) => [w.id, w.name ?? '']))

    await logAdminAudit({
      action: 'admin.error_logs.read',
      userId: auth.id,
      request,
      metadata: { count: rows?.length ?? 0 },
    })

    return NextResponse.json({
      data: (rows ?? []).map((r) => ({
        ...r,
        workspaceName: r.workspace_id ? wsName.get(r.workspace_id) ?? '—' : '—',
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Could not load error logs' }, { status: 500 })
  }
}
