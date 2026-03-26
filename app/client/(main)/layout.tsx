'use client'

import { useClientBranding } from '@/components/client/ClientBrandingContext'
import { ClientLayoutWithUnread } from '@/components/layout/ClientLayoutWithUnread'

/**
 * Top Nav + bottom MobileNav for all client app routes under (main).
 * /client/change-password stays outside this group (no chrome).
 */
export default function ClientMainLayout({ children }: { children: React.ReactNode }) {
  const { brandName, userDisplayName } = useClientBranding()
  return (
    <ClientLayoutWithUnread userDisplayName={userDisplayName} brandName={brandName}>
      {children}
    </ClientLayoutWithUnread>
  )
}
