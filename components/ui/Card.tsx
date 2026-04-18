'use client'

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type CardVariant = 'default' | 'elevated' | 'ghost' | 'flat' | 'surface' | 'raised' | 'accent' | 'glow'

const paddings = {
  default: 'p-5',
  lg: 'p-6',
} as const

function resolveVariant(v: CardVariant): 'default' | 'elevated' | 'ghost' | 'accent' | 'glow' {
  if (v === 'flat' || v === 'ghost' || v === 'surface') return v === 'surface' ? 'ghost' : 'default'
  if (v === 'raised') return 'elevated'
  if (v === 'accent') return 'accent'
  if (v === 'glow') return 'glow'
  return v
}

const variantClasses: Record<'default' | 'elevated' | 'ghost' | 'accent' | 'glow', string> = {
  default: cn(
    'rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)]',
    'shadow-[var(--shadow-xs)] text-[var(--text-primary)]'
  ),
  elevated: cn(
    'rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)]',
    'shadow-[var(--shadow-sm)] text-[var(--text-primary)]',
    'transition-[box-shadow,transform,border-color] duration-[var(--duration-slow)]',
    '[transition-timing-function:var(--ease-default)]',
    'hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] hover:-translate-y-0.5'
  ),
  ghost: cn(
    'rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]',
    'text-[var(--text-primary)]'
  ),
  accent: cn(
    'rounded-[10px] border border-[var(--accent)] bg-[var(--bg-subtle)]',
    'shadow-[0_0_0_1px_var(--ca-gold-surface)] text-[var(--text-primary)]'
  ),
  glow: cn(
    'rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)]',
    'shadow-[var(--shadow-xs)] text-[var(--text-primary)]',
    'card-glow card-gradient-border'
  ),
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: keyof typeof paddings
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'default', ...props }, ref) => {
    const resolved = resolveVariant(variant)
    return (
      <div
        ref={ref}
        className={cn(variantClasses[resolved], paddings[padding], className)}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>

function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn(
        'text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-primary)]',
        className
      )}
      {...props}
    />
  )
}

export { Card, CardTitle }
