import { fetchAdminOverviewPayload } from '@/lib/admin-overview-data'
import { logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'
import { AdminDashboardClient } from './AdminDashboardClient'

export async function AdminDashboard({ userId }: { userId: string }) {
  const service = createServiceClient()
  const data = await fetchAdminOverviewPayload(service)

  void logAdminAudit({
    action: 'admin.overview.read',
    userId,
    metadata: { source: 'founder_dashboard' },
  })

  return <AdminDashboardClient data={data} />
}
