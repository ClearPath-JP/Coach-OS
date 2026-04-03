'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useClientBranding } from '@/components/client/ClientBrandingContext'
import { coerceToAllowedCoachAccent } from '@/lib/coach-accent-phase4'
import { ClientLayoutWithUnread } from '@/components/layout/ClientLayoutWithUnread'

/**
 * Top Nav + bottom MobileNav for all client app routes under (main).
 * /client/change-password stays outside this group (no chrome).
 * Re-fetches workspace branding on navigation, focus, and interval so coach setting changes show up without a full reload.
 */
export default function ClientMainLayout({ children }: { children: React.ReactNode }) {
  const {
    brandName: serverBrandName,
    brandTagline: serverBrandTagline,
    userDisplayName,
    logoUrl: serverLogoUrl,
    accentColor: serverAccentColor,
  } = useClientBranding()
  const pathname = usePathname()
  const [brandName, setBrandName] = useState(serverBrandName)
  const [brandTagline, setBrandTagline] = useState(serverBrandTagline)
  const [logoUrl, setLogoUrl] = useState(serverLogoUrl)
  const [portalAccent, setPortalAccent] = useState(serverAccentColor)

  useEffect(() => {
    setPortalAccent(serverAccentColor)
  }, [serverAccentColor])

  useEffect(() => {
    const hex = coerceToAllowedCoachAccent(portalAccent)
    document.documentElement.style.setProperty('--cp-accent', hex)
  }, [portalAccent])

  useEffect(() => {
    setBrandName(serverBrandName)
  }, [serverBrandName])

  useEffect(() => {
    setBrandTagline(serverBrandTagline)
  }, [serverBrandTagline])

  useEffect(() => {
    setLogoUrl(serverLogoUrl)
  }, [serverLogoUrl])

  const refetchBrand = useCallback(() => {
    void fetch('/api/client/workspace-branding', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          data?: {
            brandName?: string | null
            brandTagline?: string | null
            logoUrl?: string | null
            accentColor?: string | null
          }
        } | null
        if (!res.ok || !json?.data || typeof json.data !== 'object') return
        if ('brandName' in json.data) {
          setBrandName(json.data.brandName ?? null)
        }
        if ('brandTagline' in json.data) {
          setBrandTagline(json.data.brandTagline?.trim() ? json.data.brandTagline.trim() : null)
        }
        if ('logoUrl' in json.data) {
          setLogoUrl(json.data.logoUrl?.trim() ? json.data.logoUrl.trim() : null)
        }
        if ('accentColor' in json.data && json.data.accentColor != null) {
          setPortalAccent(coerceToAllowedCoachAccent(String(json.data.accentColor)))
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
    <ClientLayoutWithUnread
      userDisplayName={userDisplayName}
      brandName={brandName}
      brandTagline={brandTagline}
      logoUrl={logoUrl}
    >
      {children}
    </ClientLayoutWithUnread>
  )
}
