import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { coerceToAllowedCoachAccent } from '@/lib/coach-accent-phase4'
import { findStance } from '@/lib/stances'

export const dynamic = 'force-dynamic'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { Nav } from '@/components/layout/Nav'
import { Sidebar } from '@/components/layout/Sidebar'
import { CoachMobileDock } from '@/components/layout/CoachMobileDock'
import { CoachKeyboardShortcuts } from '@/components/coach/CoachKeyboardShortcuts'
import { CommandPalette } from '@/components/CommandPalette'
import { getCoachSidebarNav } from '@/components/layout/coach-sidebar-nav'
import { WorkspaceProvider } from '@/lib/workspace-context'
import { workspaceProviderKey } from '@/lib/workspace-settings'
import { CoachClientErrorReportingShell } from '@/components/shared/CoachClientErrorReporting'
import { StanceInjector } from '@/components/layout/StanceInjector'
import { AmbientParticlesGuard } from '@/components/ambient/AmbientParticlesGuard'

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

  const [profileRes, workspaceId, headerList] = await Promise.all([
    supabase.from('profiles').select('role, full_name, logo_url').eq('id', user.id).maybeSingle(),
    resolveCoachWorkspaceIdForSession(supabase, user.id),
    headers(),
  ])
  const profile = profileRes.data
  const pathname = headerList.get('x-pathname') ?? ''

  if (profile?.role !== 'coach') {
    redirect('/client/portal')
  }

  let resolvedCpAccent = coerceToAllowedCoachAccent(null)
  let initialWorkspaceSettings = {
    workspaceDisplayName: null as string | null,
    brandName: null as string | null,
    accentColor: null as string | null,
    accentColorLight: null as string | null,
    logoUrl: null as string | null,
    stanceId: null as string | null,
  }

  if (workspaceId) {
    const skipSubCheck = pathname.startsWith('/coach/suspended') || pathname.startsWith('/coach/subscription')
    const [subResult, workspaceResult] = await Promise.all([
      skipSubCheck
        ? Promise.resolve({ data: null as { status: string; current_period_end: string | null } | null })
        : supabase
            .from('subscriptions')
            .select('status, current_period_end')
            .eq('workspace_id', workspaceId)
            .maybeSingle(),
      supabase
        .from('workspaces')
        .select(
          'workspace_display_name, name, logo_url, accent_color, accent_color_light, brand_name, stance_id'
        )
        .eq('id', workspaceId)
        .maybeSingle(),
    ])

    if (!skipSubCheck) {
      const sub = subResult.data
      if (!sub) {
        redirect('/coach/subscription')
      } else if (sub.status === 'past_due' || sub.status === 'cancelled') {
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date(0)
        if (periodEnd < new Date()) {
          redirect('/billing?warning=subscription')
        }
      }
    }

    const workspace = workspaceResult.data

    initialWorkspaceSettings = {
      workspaceDisplayName: workspace?.workspace_display_name ?? workspace?.name ?? null,
      brandName: workspace?.brand_name ?? null,
      accentColor: workspace?.accent_color ?? null,
      accentColorLight: workspace?.accent_color_light ?? null,
      logoUrl: workspace?.logo_url ?? null,
      stanceId: workspace?.stance_id ?? null,
    }

    resolvedCpAccent = coerceToAllowedCoachAccent(workspace?.accent_color ?? null)
  }

  const stance = findStance(initialWorkspaceSettings.stanceId)
  const stanceStyleTag = `:root {
    --cp-accent: ${resolvedCpAccent};
    --accent: ${stance.accent};
    --accent-hover: ${stance.accentHover};
    --got-gold: ${stance.accent};
    --got-gold-dim: ${stance.sectionLabelColor};
    --coach-sidebar-bg: ${stance.sidebarBg};
    --coach-sidebar-border: ${stance.sidebarBorder};
    --coach-sidebar-hover: ${stance.sidebarHover};
    --coach-sidebar-label: ${stance.sectionLabelColor};
    --text-on-accent: ${stance.textOnAccent};
  }`

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
        <style>{stanceStyleTag}</style>
        <StanceInjector stanceId={initialWorkspaceSettings.stanceId} />
        <AmbientParticlesGuard />
        <Nav
          coachApp
          userDisplayName={displayName}
          coachAvatarUrl={coachAvatarUrl}
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
                avatarUrl: coachAvatarUrl,
                settingsHref: '/coach/settings',
              }}
              className="h-full min-h-0"
            />
          </div>
          <div
            id="coach-main-scroll"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-16 lg:min-h-0 lg:overflow-y-auto lg:pb-0 lg:pl-[var(--sidebar-width)]"
          >
            <CoachClientErrorReportingShell>{children}</CoachClientErrorReportingShell>
          </div>
        </div>
        <CoachMobileDock />
        <CoachKeyboardShortcuts />
        <CommandPalette />
      </div>
    </WorkspaceProvider>
  )
}
