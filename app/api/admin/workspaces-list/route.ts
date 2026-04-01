import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()
    const { data, error } = await service.from('workspaces').select('id,name').order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAdminAudit({
      action: 'admin.workspaces_list.read',
      userId: auth.id,
      request,
    })
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Could not load workspaces' }, { status: 500 })
  }
}
