'use client'

import { useEffect, useState } from 'react'
import { AmbientParticles } from '@/components/ambient/AmbientParticles'
import { useWorkspace } from '@/lib/workspace-context'

/**
 * Reads localStorage toggle and renders AmbientParticles if enabled.
 * Listens for storage events so the settings page toggle takes effect immediately.
 */
export function AmbientParticlesGuard() {
  const { settings } = useWorkspace()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const check = () => {
      try {
        setEnabled(localStorage.getItem('clearpath-ambient-particles') !== 'false')
      } catch {
        setEnabled(false)
      }
    }
    check()

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'clearpath-ambient-particles') check()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (!enabled) return null
  return <AmbientParticles stanceId={settings.stanceId} />
}
