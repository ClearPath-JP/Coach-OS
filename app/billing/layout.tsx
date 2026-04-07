import { redirect } from 'next/navigation'
import { coachAccentStyleTagContent, coerceToAllowedCoachAccent } from '@/lib/coach-accent-phase4'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { MobileNav, coachTabs } from '@/components/layout/MobileNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { getCoachSidebarNav } from '@/components/layout/coach-sidebar-nav'
import { WorkspaceProvider } from '@/lib/workspace-context'
import { workspaceProviderKey } from '@/lib/workspace-settings'
import { CommandPalette } from '@/components/CommandPalette'
import { AccentInjector } from '@/components/layout/AccentInjector'

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

  let resolvedCpAccent = coerceToAllowedCoachAccent(null)
  let initialWorkspaceSettings = {
    workspaceDisplayName: null,
    brandName: null,
    accentColor: null,
    accentColorLight: null,
    logoUrl: null,
  }
  const { data: coach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (coach?.workspace_id) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select(
        'workspace_display_name, name, logo_url, accent_color, accent_color_light, brand_name'
      )
      .eq('id', coach.workspace_id)
      .maybeSingle()

    initialWorkspaceSettings = {
      workspaceDisplayName: workspace?.workspace_display_name ?? workspace?.name ?? null,
      brandName: workspace?.brand_name ?? null,
      accentColor: workspace?.accent_color ?? null,
      accentColorLight: workspace?.accent_color_light ?? null,
      logoUrl: workspace?.logo_url ?? null,
    }

    resolvedCpAccent = coerceToAllowedCoachAccent(workspace?.accent_color ?? null)
  }

  const cpAccentStyle = coachAccentStyleTagContent(resolvedCpAccent)

  return (
    <WorkspaceProvider
      key={workspaceProviderKey(initialWorkspaceSettings)}
      initialSettings={initialWorkspaceSettings}
    >
      <div className="flex min-h-screen min-h-0 flex-col bg-[var(--cp-offwhite)] lg:grid lg:h-[100dvh] lg:grid-rows-[var(--nav-height)_minmax(0,1fr)] lg:overflow-hidden">
        <style>{cpAccentStyle}</style>
        <AccentInjector accentColor={resolvedCpAccent} />
        <Nav
          coachApp
          userDisplayName={displayName}
          coachAvatarUrl={profile?.logo_url ?? null}
        />
        <div className="relative flex min-h-0 flex-1 flex-col lg:min-h-0">
          <div className="pointer-events-none hidden lg:fixed lg:left-0 lg:top-[var(--nav-height)] lg:z-40 lg:flex lg:h-[calc(100dvh-var(--nav-height))] lg:w-[var(--sidebar-width)] lg:pointer-events-auto">
            <Sidebar
              variant="coach"
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
          <div className="page-content min-h-0 min-w-0 flex-1 overflow-y-auto pb-16 lg:min-h-0 lg:overflow-y-auto lg:pb-0 lg:pl-[var(--sidebar-width)]">
            {children}
          </div>
        </div>
        <MobileNav tabs={coachTabs} />
        <CommandPalette />
      </div>
    </WorkspaceProvider>
  )
}
