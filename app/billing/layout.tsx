import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { MobileNav, coachTabs } from '@/components/layout/MobileNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { getCoachSidebarNav } from '@/components/layout/coach-sidebar-nav'

/**
 * Billing layout: coach-only; same shell as coach area (Nav + sidebar + MobileNav).
 */
export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, logo_url')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'coach') {
    redirect(profile?.role === 'client' ? '/client/portal' : '/coach/dashboard')
  }

  const displayName =
    profile?.full_name?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'Coach'
  const { topItems, sections } = getCoachSidebarNav()

  return (
    <div className="flex min-h-screen min-h-0 flex-col bg-[var(--bg-app)] lg:grid lg:h-[100dvh] lg:grid-rows-[var(--nav-height)_minmax(0,1fr)] lg:overflow-hidden">
      <Nav
        coachApp
        showThemeToggle
        userDisplayName={displayName}
        coachAvatarUrl={profile?.logo_url ?? null}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:min-h-0 lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <div className="hidden min-h-0 lg:flex">
          <Sidebar
            wordmark
            topItems={topItems}
            sections={sections}
            userBar={{
              displayName,
              roleLabel: 'Coach',
              avatarUrl: profile?.logo_url ?? null,
              settingsHref: '/coach/settings',
            }}
            className="h-full min-h-0"
          />
        </div>
        <div className="page-content min-h-0 min-w-0 flex-1 overflow-y-auto pb-16 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
          {children}
        </div>
      </div>
      <MobileNav tabs={coachTabs} />
    </div>
  )
}
