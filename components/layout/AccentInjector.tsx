'use client'

import { useLayoutEffect } from 'react'

export interface AccentInjectorProps {
  accentColor: string
}

/**
 * Sets `--cp-accent` on the document root (hydration-safe follow-up to server-injected style).
 */
export function AccentInjector({ accentColor }: AccentInjectorProps) {
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--cp-accent', accentColor)
  }, [accentColor])
  return null
}
