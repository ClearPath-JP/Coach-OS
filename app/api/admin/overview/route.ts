import { NextResponse } from 'next/server'
import { fetchAdminOverviewPayload } from '@/lib/admin-overview-data'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()
    const data = await fetchAdminOverviewPayload(service)

    void logAdminAudit({
      action: 'admin.overview.read',
      userId: auth.id,
      request,
      metadata: { workspaces: data.workspaces.length },
    })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Could not load admin overview' }, { status: 500 })
  }
}
