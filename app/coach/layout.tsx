import { redirect } from 'next/navigation'
import { getAccentLight, resolveAccentFamily } from '@/lib/accent-colors'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { getCoachSidebarNav } from '@/components/layout/coach-sidebar-nav'

/**
 * Coach layout: require auth + role === 'coach' (11-auth §4.2).
 * Non-coach → /client/dashboard.
 * Desktop (lg+): top Nav + Sidebar + content (viewport-locked height). Mobile: Nav + content + bottom MobileNav.
 */
export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, logo_url')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'coach') {
    redirect('/client/portal')
  }

  let workspaceAccentStyle = ''
  const { data: coach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (coach?.workspace_id) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('accent_color, accent_color_light')
      .eq('id', coach.workspace_id)
      .maybeSingle()
    if (workspace?.accent_color) {
      const light = workspace.accent_color_light ?? getAccentLight(workspace.accent_color)
      const fam = resolveAccentFamily(workspace.accent_color, light)
      workspaceAccentStyle = `:root { --accent: ${fam.accent}; --accent-dark: ${fam.accentDark}; --accent-hover: ${fam.hover}; --accent-light: ${fam.light}; --accent-muted: ${fam.muted}; }`
    }
  }

  const displayName =
    profile?.full_name?.trim() ||
    user.email?.split('@')[0]?.trim() ||
    'Coach'
  const { topItems, sections } = getCoachSidebarNav()

  return (
    <div className="flex min-h-screen min-h-0 flex-col bg-[var(--bg-app)] lg:grid lg:h-[100dvh] lg:grid-rows-[var(--nav-height)_minmax(0,1fr)] lg:overflow-hidden">
      {workspaceAccentStyle ? <style>{workspaceAccentStyle}</style> : null}
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
        <div
          id="coach-main-scroll"
          className="page-content flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-16 lg:min-h-0 lg:overflow-y-auto lg:pb-0"
        >
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
