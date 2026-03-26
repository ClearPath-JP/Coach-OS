'use client'

import { useEffect, useState } from 'react'

/**
 * Shows coach brand or "ClearPath" for client auth surfaces (set-password, change-password).
 */
export function ClientAuthBrandTitle({
  className = 'text-center text-xl font-medium text-[var(--color-ink)]',
}: {
  className?: string
}) {
  const [label, setLabel] = useState('ClearPath')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/client/workspace-branding', { credentials: 'include' })
        const json = (await res.json().catch(() => null)) as {
          data?: { brandName?: string | null }
        } | null
        const name = json?.data?.brandName?.trim()
        if (!cancelled && name) setLabel(name)
      } catch {
        // keep default
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return <h1 className={className}>{label}</h1>
}
