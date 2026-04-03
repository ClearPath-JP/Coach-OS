import { Suspense } from 'react'
import { DashboardHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/dashboard/skeletons'
import { CoachDashboardWithProfile } from './CoachDashboardWithProfile'

function CoachDashboardFallback() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <DashboardHeaderSkeleton />
      <StatCardsSkeleton />
      <TableSkeleton />
    </div>
  )
}

export default function CoachDashboardPage() {
  return (
    <Suspense fallback={<CoachDashboardFallback />}>
      <CoachDashboardWithProfile />
    </Suspense>
  )
}
