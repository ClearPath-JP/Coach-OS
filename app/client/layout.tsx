import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'
import { normalizeEmail } from '@/lib/utils'
import { ClientBrandingProvider } from '@/components/client/ClientBrandingContext'

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

  return (
    <ClientBrandingProvider
      value={{
        brandName: branding?.brandName ?? null,
        workspaceId: branding?.workspaceId ?? null,
        userDisplayName: clientDisplayName,
      }}
    >
      {children}
    </ClientBrandingProvider>
  )
}
