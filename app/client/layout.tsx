import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'
import { normalizeEmail } from '@/lib/utils'
import { ClientBrandingProvider } from '@/components/client/ClientBrandingContext'
import { CoachClientErrorReportingShell } from '@/components/shared/CoachClientErrorReporting'
import { AccentInjector } from '@/components/layout/AccentInjector'
import { coerceToAllowedCoachAccent } from '@/lib/coach-accent-phase4'

/**
 * Client layout: require auth + role !== 'coach' (11-auth §4.2).
 * Branding context for all /client/*; Nav + MobileNav live in (main)/layout.tsx.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role === 'coach') {
    redirect('/coach/dashboard')
  }

  if (profile?.role === 'client') {
    const pathname = (await headers()).get('x-pathname') ?? ''
    const mustChange = user.user_metadata?.must_change_password === true
    const isChangingPassword = pathname === '/client/change-password'
    if (mustChange && !isChangingPassword) {
      redirect('/client/change-password')
    }
  }

  let clientDisplayName: string | null = null
  if (user.email) {
    const { data: client } = await supabase
      .from('clients')
      .select('first_name, last_name')
      .eq('email', normalizeEmail(user.email))
      .maybeSingle()
    if (client) {
      clientDisplayName = [client.first_name, client.last_name].filter(Boolean).join(' ') || null
    }
  }

  const branding = await getClientWorkspaceBranding(user.email)
  const clientCpAccent = coerceToAllowedCoachAccent(branding?.accentColor ?? null)

  return (
    <>
      <style>{`:root { --cp-accent: ${clientCpAccent}; }`}</style>
      <AccentInjector accentColor={clientCpAccent} />
    <div className="cp-scope">
    <ClientBrandingProvider
      value={{
        brandName: branding?.brandName ?? null,
        brandTagline: branding?.brandTagline?.trim() ? branding.brandTagline.trim() : null,
        workspaceId: branding?.workspaceId ?? null,
        userDisplayName: clientDisplayName,
        logoUrl: branding?.logoUrl?.trim() ? branding.logoUrl.trim() : null,
        accentColor: clientCpAccent,
      }}
    >
      <CoachClientErrorReportingShell>{children}</CoachClientErrorReportingShell>
    </ClientBrandingProvider>
    </div>
    </>
  )
}
