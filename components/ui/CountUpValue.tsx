'use client'

import { useEffect, useRef, useState } from 'react'

type CountUpValueProps = {
  value: number
  durationMs?: number
  className?: string
  formatter?: (value: number) => string
  /** Animate from 0 once on mount (e.g. dashboard stats after data loads). Later value changes snap. */
  animateOnce?: boolean
}

/**
 * Smoothly animates numeric values. With `animateOnce`, runs a single ease-out count from 0 on mount.
 */
export function CountUpValue({
  value,
  durationMs = 600,
  className,
  formatter = (n) => String(n),
  animateOnce = false,
}: CountUpValueProps) {
  const [display, setDisplay] = useState(() => (animateOnce ? 0 : value))
  const previousRef = useRef(value)
  const onceDoneRef = useRef(false)

  useEffect(() => {
    if (animateOnce) {
      if (onceDoneRef.current) {
        setDisplay(value)
        return
      }
      const to = value
      let rafId = 0
      const start = performance.now()
      const from = 0
      const step = (now: number) => {
        const elapsed = now - start
        const t = Math.min(1, elapsed / durationMs)
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplay(from + (to - from) * eased)
        if (t < 1) {
          rafId = requestAnimationFrame(step)
        } else {
          setDisplay(to)
          onceDoneRef.current = true
        }
      }
      rafId = requestAnimationFrame(step)
      return () => cancelAnimationFrame(rafId)
    }

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
  }, [value, durationMs, animateOnce])

  return <span className={className}>{formatter(display)}</span>
}
