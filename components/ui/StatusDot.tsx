'use client'

import { cn } from '@/lib/utils'

type StatusTone = 'active' | 'pending' | 'error' | 'inactive'

const toneClass: Record<StatusTone, string> = {
  active: 'bg-[var(--success)]',
  pending: 'bg-[var(--warning)]',
  error: 'bg-[var(--error)]',
  inactive: 'bg-[var(--text-quaternary)]',
}

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: StatusTone
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', toneClass[tone], pulse && 'status-dot-pulse', className)}
      aria-hidden
    />
  )
}
