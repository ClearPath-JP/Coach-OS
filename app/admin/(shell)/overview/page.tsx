import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { createClient } from '@/lib/supabase-server'
import { AdminDashboard } from './AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isPlatformAdmin(supabase, user))) redirect('/admin/not-authorized')

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-subtle)]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
        </div>
      }
    >
      <AdminDashboard userId={user.id} />
    </Suspense>
  )
}
