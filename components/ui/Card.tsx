'use client'

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type CardVariant = 'default' | 'elevated' | 'ghost' | 'flat' | 'surface' | 'raised' | 'accent'

const paddings = {
  default: 'p-5',
  lg: 'p-6',
} as const

function resolveVariant(v: CardVariant): 'default' | 'elevated' | 'ghost' | 'accent' {
  if (v === 'flat' || v === 'ghost' || v === 'surface') return v === 'surface' ? 'ghost' : 'default'
  if (v === 'raised') return 'elevated'
  if (v === 'accent') return 'accent'
  return v
}

const variantClasses: Record<'default' | 'elevated' | 'ghost' | 'accent', string> = {
  default: cn(
    'rounded-[var(--radius-lg)] border border-[rgba(255,250,240,0.04)] bg-[var(--bg-subtle)]',
    'shadow-[var(--shadow-xs)] text-[var(--text-primary)]'
  ),
  elevated: cn(
    'rounded-[var(--radius-lg)] border border-[rgba(255,250,240,0.04)] bg-[var(--bg-subtle)]',
    'shadow-[var(--shadow-sm)] text-[var(--text-primary)]',
    'transition-[box-shadow,transform,border-color] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
    'hover:shadow-[0_8px_24px_rgba(12,8,4,0.2)] hover:border-[rgba(196,164,74,0.12)] hover:-translate-y-0.5'
  ),
  ghost: cn(
    'rounded-[var(--radius-lg)] border border-[rgba(255,250,240,0.04)] bg-[var(--bg-subtle)]',
    'text-[var(--text-primary)]'
  ),
  accent: cn(
    'rounded-[var(--radius-lg)] border border-[rgba(196,164,74,0.12)] bg-[var(--bg-subtle)]',
    'shadow-[0_0_0_1px_rgba(196,164,74,0.04)] text-[var(--text-primary)]'
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
        'font-display text-[var(--text-20)] font-[500] leading-[var(--leading-heading)] tracking-[0.01em] text-[var(--text-primary)]',
        className
      )}
      {...props}
    />
  )
}

export { Card, CardTitle }
