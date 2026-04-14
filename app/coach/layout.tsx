import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { coerceToAllowedCoachAccent } from '@/lib/coach-accent-phase4'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { WorkspaceProvider } from '@/lib/workspace-context'
import { workspaceProviderKey } from '@/lib/workspace-settings'
import { CoachClientErrorReportingShell } from '@/components/shared/CoachClientErrorReporting'
import { CoachNav } from './CoachNav'

export const dynamic = 'force-dynamic'

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, workspaceId, headerList] = await Promise.all([
    supabase.from('profiles').select('role, full_name, logo_url').eq('id', user.id).maybeSingle(),
    resolveCoachWorkspaceIdForSession(supabase, user.id),
    headers(),
  ])
  const profile = profileRes.data
  const pathname = headerList.get('x-pathname') ?? ''

  if (profile?.role !== 'coach') redirect('/client/portal')

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
        .select('workspace_display_name, name, logo_url, accent_color, accent_color_light, brand_name, stance_id')
        .eq('id', workspaceId)
        .maybeSingle(),
    ])

    if (!skipSubCheck) {
      const sub = subResult.data
      if (!sub) {
        redirect('/coach/subscription')
      } else if (sub.status === 'past_due' || sub.status === 'cancelled') {
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date(0)
        if (periodEnd < new Date()) redirect('/billing?warning=subscription')
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

  const brandName = initialWorkspaceSettings.brandName
    || initialWorkspaceSettings.workspaceDisplayName
    || 'COACH-OS'

  const accentStyle = `:root { --cp-accent: ${resolvedCpAccent}; --accent: ${resolvedCpAccent}; }`

  return (
    <WorkspaceProvider
      key={workspaceProviderKey(initialWorkspaceSettings)}
      initialSettings={initialWorkspaceSettings}
    >
      <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-app)]">
        <style>{accentStyle}</style>
        <CoachNav
          brandName={brandName}
          coachName={profile?.full_name ?? null}
          coachAvatarUrl={profile?.logo_url ?? initialWorkspaceSettings.logoUrl ?? null}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <CoachClientErrorReportingShell>{children}</CoachClientErrorReportingShell>
        </main>
      </div>
    </WorkspaceProvider>
  )
}
