import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/layout/AdminNav'
import { AdminSidebarFooter } from '@/components/layout/AdminSidebarFooter'
import { AdminWarningBanner } from '@/components/layout/AdminWarningBanner'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { createClient } from '@/lib/supabase-server'

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/overview')
  if (!(await isPlatformAdmin(supabase, user))) redirect('/admin/not-authorized')

  const email = user.email ?? ''

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0F172A] text-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#1E293B] bg-[#0F172A] px-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/overview" className="text-[15px] font-semibold text-white">
            ClearPath
          </Link>
          <span className="rounded-full bg-[#DC2626] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Admin
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-[12px] text-slate-400">{email}</span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex h-full min-h-0 w-[220px] shrink-0 flex-col border-r border-[#1E293B] bg-[#0F172A] py-3">
          <AdminNav />
          <AdminSidebarFooter email={email} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto bg-[#F8FAFC] p-8 text-slate-900">
          <AdminWarningBanner />
          {children}
        </main>
      </div>
    </div>
  )
}
