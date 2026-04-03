'use client'

import { useEffect, useState } from 'react'

const COOKIE = 'clearpath_portal_hero_seen'

function readCookie(name: string): boolean {
  if (typeof document === 'undefined') return true
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${name}=`))
}

function setCookie(name: string) {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${name}=1;path=/;max-age=${maxAge};SameSite=Lax`
}

/**
 * First visit or forced visible: show coach hero; then set cookie so repeat visits skip
 * (unless coach updates branding — parent can pass remount key).
 */
export function PortalBrandedHero({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const run = () => {
      if (readCookie(COOKIE)) {
        setShow(false)
      } else {
        setShow(true)
        setCookie(COOKIE)
      }
      setReady(true)
    }
    queueMicrotask(run)
  }, [])

  if (!ready) return null
  if (!show) return null
  return <>{children}</>
}
