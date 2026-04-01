import { AdminCoachWorkspaceDetail } from '@/components/admin/AdminCoachWorkspaceDetail'

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  return <AdminCoachWorkspaceDetail workspaceId={workspaceId} />
}
