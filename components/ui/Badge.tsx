'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'accent'
  | 'active'
  | 'inactive'
  | 'pending'

function resolveVariant(
  v: BadgeVariant
): 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent' {
  if (v === 'active') return 'success'
  if (v === 'inactive') return 'neutral'
  if (v === 'pending') return 'warning'
  return v
}

const variantClasses: Record<
  'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent',
  string
> = {
  success:
    'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]',
  warning:
    'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  error: 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]',
  neutral:
    'bg-[var(--bg-muted)] text-[var(--text-tertiary)] border-[var(--border-default)]',
  accent:
    'bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent-muted)]',
}

const base = cn(
  'badge inline-flex max-w-full items-center gap-1 rounded-[var(--radius-full)] border px-2 py-0.5',
  'text-[12px] font-medium whitespace-nowrap [font-family:var(--font)]'
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

function Badge({ className, variant = 'neutral', dot = false, children, ...props }: BadgeProps) {
  const v = resolveVariant(variant)
  return (
    <span className={cn(base, variantClasses[v], className)} {...props}>
      {dot ? (
        <span
          className="size-1 shrink-0 rounded-[var(--radius-full)] bg-current opacity-90"
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  )
}

export { Badge }
