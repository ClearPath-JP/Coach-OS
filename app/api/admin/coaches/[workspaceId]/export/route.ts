import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

type Ctx = { params: Promise<{ workspaceId: string }> }

function csvEscape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

/** GET — CSV export of workspace + clients for support / backups. */
export async function GET(request: Request, context: Ctx) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = await context.params
    const service = createServiceClient()

    const [{ data: ws }, { data: coachRow }, { data: sub }, { data: clients }] = await Promise.all([
      service.from('workspaces').select('id,name,status,created_at').eq('id', workspaceId).maybeSingle(),
      service.from('coaches').select('user_id').eq('workspace_id', workspaceId).maybeSingle(),
      service.from('subscriptions').select('plan,status').eq('workspace_id', workspaceId).maybeSingle(),
      service
        .from('clients')
        .select('first_name,last_name,email,phone,status,created_at,updated_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
    ])

    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    let coachEmail = ''
    if (coachRow?.user_id) {
      const { data: prof } = await service
        .from('profiles')
        .select('email,full_name')
        .eq('id', coachRow.user_id)
        .maybeSingle()
      coachEmail = prof?.email ?? ''
    }

    const lines: string[] = []
    lines.push('section,key,value')
    lines.push(['workspace', 'id', workspaceId].map(csvEscape).join(','))
    lines.push(['workspace', 'name', ws.name ?? ''].map(csvEscape).join(','))
    lines.push(['workspace', 'status', ws.status ?? ''].map(csvEscape).join(','))
    lines.push(['workspace', 'created_at', ws.created_at ?? ''].map(csvEscape).join(','))
    lines.push(['workspace', 'coach_email', coachEmail].map(csvEscape).join(','))
    lines.push(['workspace', 'plan', sub?.plan ?? 'free'].map(csvEscape).join(','))
    lines.push(['workspace', 'subscription_status', sub?.status ?? ''].map(csvEscape).join(','))
    lines.push('')
    lines.push('client,first_name,last_name,email,phone,status,created_at,updated_at')
    for (const c of clients ?? []) {
      lines.push(
        [
          'client',
          c.first_name ?? '',
          c.last_name ?? '',
          c.email ?? '',
          c.phone ?? '',
          c.status ?? '',
          c.created_at ?? '',
          c.updated_at ?? '',
        ]
          .map((v) => csvEscape(String(v)))
          .join(',')
      )
    }

    const body = lines.join('\n')
    const filename = `workspace-${workspaceId.slice(0, 8)}-export.csv`

    await logAdminAudit({
      action: 'admin.workspace.export_csv',
      userId: auth.id,
      workspaceId,
      request,
      metadata: { clientRows: (clients ?? []).length },
    })

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not export workspace' }, { status: 500 })
  }
}
