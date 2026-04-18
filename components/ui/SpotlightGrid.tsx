'use client'

import { useRef, useCallback, type ReactNode, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'

interface SpotlightGridProps {
  children: ReactNode
  className?: string
  /** Grid column classes, e.g. "grid-cols-2 lg:grid-cols-4" */
  columns?: string
}

/**
 * A card grid with a cursor-tracking radial spotlight effect.
 * Wrap stat cards or feature cards in this component to get
 * a subtle glow that follows the mouse across the grid.
 *
 * Uses CSS custom properties instead of React state for
 * zero-rerender mouse tracking.
 */
export function SpotlightGrid({
  children,
  className,
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}: SpotlightGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !overlayRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    overlayRef.current.style.background =
      `radial-gradient(600px circle at ${x}px ${y}px, rgba(159, 18, 57, 0.06), transparent 40%)`
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (overlayRef.current) overlayRef.current.style.opacity = '1'
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (overlayRef.current) overlayRef.current.style.opacity = '0'
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative grid gap-[var(--coach-card-gap)]', columns, className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight overlay — positioned via direct DOM manipulation for performance */}
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
        style={{ opacity: 0 }}
        aria-hidden
      />
      {children}
    </div>
  )
}
