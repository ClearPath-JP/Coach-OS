'use client'

import { useLayoutEffect } from 'react'
import { findStance } from '@/lib/stances'

export interface StanceInjectorProps {
  stanceId: string | null
  /** Optional accent override (if coach manually set an accent outside stance system) */
  accentOverride?: string | null
}

/**
 * Sets all stance-derived CSS variables on the document root.
 * Runs in useLayoutEffect for hydration-safe application (no flash).
 */
export function StanceInjector({ stanceId, accentOverride }: StanceInjectorProps) {
  useLayoutEffect(() => {
    const stance = findStance(stanceId)
    const root = document.documentElement

    const accent = accentOverride || stance.accent
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-hover', stance.accentHover)
    root.style.setProperty('--accent-light', stance.accentLight)
    root.style.setProperty('--accent-muted', stance.accentMuted)
    root.style.setProperty('--text-on-accent', stance.textOnAccent)
    root.style.setProperty('--cp-accent', accent)

    root.style.setProperty('--got-gold', stance.accent)
    root.style.setProperty('--got-gold-dim', stance.sectionLabelColor)

    root.style.setProperty('--coach-sidebar-bg', stance.sidebarBg)
    root.style.setProperty('--coach-sidebar-border', stance.sidebarBorder)
    root.style.setProperty('--coach-sidebar-hover', stance.sidebarHover)
    root.style.setProperty('--coach-sidebar-label', stance.sectionLabelColor)
  }, [stanceId, accentOverride])

  return null
}
