'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ClearPathLogo } from '@/components/layout/ClearPathLogo'

// Public pages a coach reaches from an ad/link must paint instantly — never gate
// them behind a splash. The brand splash only plays inside the authed app, once
// per session, and never when the visitor asked for reduced motion.
const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/privacy',
  '/terms',
  '/refunds',
  '/browse',
  '/subscribe',
  '/onboarding',
]

export function AppLoadingScreen() {
  const pathname = usePathname()
  const isPublic =
    pathname === '/' ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Start hidden (no SSR flash); the effect decides whether to show it.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isPublic) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return
    if (sessionStorage.getItem('korva-splash-played') === '1') return
    sessionStorage.setItem('korva-splash-played', '1')
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), 320)
    return () => window.clearTimeout(t)
  }, [isPublic])

  if (!visible) return null
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-app)] transition-opacity">
      <div className="app-logo-pulse">
        <ClearPathLogo size={40} />
      </div>
      <p className="mt-3 text-[15px] font-semibold tracking-[0.12em] text-[var(--text-primary)]">
        KOR<span style={{ color: 'var(--accent)' }}>VA</span>
      </p>
    </div>
  )
}
