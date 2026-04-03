import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AdminGuideLink } from '@/components/admin/AdminGuideLink'
import { AdminOverviewDataSkeleton } from '@/components/admin/AdminOverviewDataSkeleton'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { createClient } from '@/lib/supabase-server'
import { AdminOverviewBody } from './AdminOverviewBody'

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isPlatformAdmin(supabase, user))) redirect('/admin/not-authorized')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Business health at a glance — coaches, clients, revenue, and platform status.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          New to this area? Read the <AdminGuideLink className="font-medium text-blue-700 hover:underline" /> for a tour
          of every screen.
        </p>
      </div>

      <Suspense fallback={<AdminOverviewDataSkeleton />}>
        <AdminOverviewBody userId={user.id} />
      </Suspense>
    </div>
  )
}
