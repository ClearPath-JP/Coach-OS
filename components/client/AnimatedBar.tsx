'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function AnimatedBar({
  percent,
  className,
  fillClassName,
}: {
  percent: number
  className?: string
  /** e.g. bg-[var(--accent)] or bg-[var(--success)] */
  fillClassName?: string
}) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.min(100, Math.max(0, percent))))
    return () => cancelAnimationFrame(id)
  }, [percent])

  return (
    <div className={cn('h-full w-full overflow-hidden rounded-full bg-[var(--border-default)]', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-[600ms] ease-out', fillClassName ?? 'bg-[var(--accent)]')}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}
