import { redirect } from 'next/navigation'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { createClient } from '@/lib/supabase-server'
import { AdminShellHeader } from '@/components/admin/AdminShellHeader'

export const dynamic = 'force-dynamic'

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/overview')
  if (!(await isPlatformAdmin(supabase, user))) redirect('/admin/not-authorized')

  const email = user.email ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <AdminShellHeader email={email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
