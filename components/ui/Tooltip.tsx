'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function Tooltip({
  content,
  children,
  className,
}: {
  content: string
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [below, setBelow] = useState(false)
  const t = useRef<number | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    return () => {
      if (t.current) window.clearTimeout(t.current)
    }
  }, [])

  const onEnter = () => {
    if (t.current) window.clearTimeout(t.current)
    t.current = window.setTimeout(() => {
      const top = wrapRef.current?.getBoundingClientRect().top ?? 0
      setBelow(top < 56)
      setOpen(true)
    }, 400)
  }

  const onLeave = () => {
    if (t.current) window.clearTimeout(t.current)
    setOpen(false)
  }

  return (
    <span
      ref={wrapRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-[120] -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium',
            'bg-[var(--text-primary)] text-white shadow-[var(--shadow-md)] tooltip-in',
            below ? 'top-[calc(100%+10px)]' : 'bottom-[calc(100%+10px)]'
          )}
        >
          {content}
          <span
            className={cn(
              'absolute left-1/2 size-2 -translate-x-1/2 rotate-45 bg-[var(--text-primary)]',
              below ? '-top-1' : '-bottom-1'
            )}
            aria-hidden
          />
        </span>
      ) : null}
    </span>
  )
}
