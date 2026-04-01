'use client'

import { useEffect, useRef, useState } from 'react'

type CountUpValueProps = {
  value: number
  durationMs?: number
  className?: string
  formatter?: (value: number) => string
}

/**
 * Smoothly animates numeric values whenever `value` changes.
 */
export function CountUpValue({
  value,
  durationMs = 700,
  className,
  formatter = (n) => String(n),
}: CountUpValueProps) {
  const [display, setDisplay] = useState(value)
  const previousRef = useRef(value)

  useEffect(() => {
    const from = previousRef.current
    const to = value
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) {
      previousRef.current = to
      setDisplay(to)
      return
    }

    let rafId = 0
    const start = performance.now()

    const step = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (to - from) * eased
      setDisplay(next)
      if (t < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        setDisplay(to)
      }
    }

    rafId = requestAnimationFrame(step)
    previousRef.current = to
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [value, durationMs])

  return <span className={className}>{formatter(display)}</span>
}

