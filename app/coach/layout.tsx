import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAccentLight, resolveAccentFamily } from '@/lib/accent-colors'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { CoachKeyboardShortcuts } from '@/components/coach/CoachKeyboardShortcuts'
import { CommandPalette } from '@/components/CommandPalette'
import { getCoachSidebarNav } from '@/components/layout/coach-sidebar-nav'
import { WorkspaceProvider } from '@/lib/workspace-context'
import { workspaceProviderKey } from '@/lib/workspace-settings'
import { CoachClientErrorReportingShell } from '@/components/shared/CoachClientErrorReporting'

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
  let initialWorkspaceSettings = {
    workspaceDisplayName: null,
    brandName: null,
    accentColor: null,
    accentColorLight: null,
    logoUrl: null,
  }
  const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (workspaceId && !pathname.startsWith('/coach/suspended')) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (sub?.status === 'past_due' || sub?.status === 'cancelled') {
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date(0)
      if (periodEnd < new Date()) {
        redirect('/billing?warning=subscription')
      }
    }
  }
  if (workspaceId) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select(
        'workspace_display_name, name, logo_url, accent_color, accent_color_light, brand_name'
      )
      .eq('id', workspaceId)
      .maybeSingle()

    initialWorkspaceSettings = {
      workspaceDisplayName: workspace?.workspace_display_name ?? workspace?.name ?? null,
      brandName: workspace?.brand_name ?? null,
      accentColor: workspace?.accent_color ?? null,
      accentColorLight: workspace?.accent_color_light ?? null,
      logoUrl: workspace?.logo_url ?? null,
    }

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

  const profileLogo = profile?.logo_url?.trim() || ''
  let coachAvatarUrl: string | null = profileLogo || null
  if (!coachAvatarUrl) {
    const { data: coachProfile } = await supabase
      .from('coach_profiles')
      .select('profile_image_url')
      .eq('coach_id', user.id)
      .maybeSingle()
    const fromCoachProfile = coachProfile?.profile_image_url?.trim()
    if (fromCoachProfile) coachAvatarUrl = fromCoachProfile
  }

  const { topItems, sections } = getCoachSidebarNav()

  return (
    <WorkspaceProvider
      key={workspaceProviderKey(initialWorkspaceSettings)}
      initialSettings={initialWorkspaceSettings}
    >
      <div className="flex min-h-screen min-h-0 flex-col bg-[var(--bg-app)] lg:grid lg:h-[100dvh] lg:grid-rows-[var(--nav-height)_minmax(0,1fr)] lg:overflow-hidden">
        {workspaceAccentStyle ? <style>{workspaceAccentStyle}</style> : null}
        <Nav
          coachApp
          showThemeToggle
          userDisplayName={displayName}
          coachAvatarUrl={coachAvatarUrl}
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
                avatarUrl: coachAvatarUrl,
                settingsHref: '/coach/settings',
              }}
              className="h-full min-h-0"
            />
          </div>
          <div
            id="coach-main-scroll"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-16 lg:min-h-0 lg:overflow-y-auto lg:pb-0"
          >
            <CoachClientErrorReportingShell>{children}</CoachClientErrorReportingShell>
          </div>
        </div>
        <MobileNav />
        <CoachKeyboardShortcuts />
        <CommandPalette />
      </div>
    </WorkspaceProvider>
  )
}
