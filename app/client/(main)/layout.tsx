'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useClientBranding } from '@/components/client/ClientBrandingContext'
import { ClientLayoutWithUnread } from '@/components/layout/ClientLayoutWithUnread'

/**
 * Top Nav + bottom MobileNav for all client app routes under (main).
 * /client/change-password stays outside this group (no chrome).
 * Re-fetches workspace branding on navigation, focus, and interval so coach setting changes show up without a full reload.
 */
export default function ClientMainLayout({ children }: { children: React.ReactNode }) {
  const { brandName: serverBrandName, userDisplayName } = useClientBranding()
  const pathname = usePathname()
  const [brandName, setBrandName] = useState(serverBrandName)

  useEffect(() => {
    setBrandName(serverBrandName)
  }, [serverBrandName])

  const refetchBrand = useCallback(() => {
    void fetch('/api/client/workspace-branding', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { data?: { brandName?: string | null } } | null
        if (!res.ok || !json?.data || typeof json.data !== 'object') return
        if ('brandName' in json.data) {
          setBrandName(json.data.brandName ?? null)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    refetchBrand()
  }, [pathname, refetchBrand])

  useEffect(() => {
    const id = window.setInterval(refetchBrand, 90_000)
    const onFocus = () => refetchBrand()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refetchBrand])

  return (
    <ClientLayoutWithUnread userDisplayName={userDisplayName} brandName={brandName}>
      {children}
    </ClientLayoutWithUnread>
  )
}
