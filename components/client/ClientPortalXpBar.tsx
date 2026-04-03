'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  percent: number
  className?: string
}

/**
 * XP bar with a short celebratory CSS animation when the fill width increases (e.g. after earning XP).
 */
export function ClientPortalXpBar({ percent, className }: Props) {
  const clamped = Math.min(100, Math.max(0, percent))
  const prevRef = useRef<number | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = clamped
    if (prev === null) return undefined
    if (clamped > prev) {
      const t0 = window.setTimeout(() => {
        setCelebrate(true)
      }, 0)
      const t1 = window.setTimeout(() => {
        setCelebrate(false)
      }, 900)
      return () => {
        window.clearTimeout(t0)
        window.clearTimeout(t1)
      }
    }
    return undefined
  }, [clamped])

  return (
    <div
      className={`relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-default)] ${className ?? ''}`}
    >
      <div
        className={`h-full rounded-full bg-[var(--cp-accent)] transition-[width] duration-700 ease-out ${celebrate ? 'animate-xp-bar-celebrate' : ''}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
