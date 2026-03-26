'use client'

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type CardVariant = 'default' | 'elevated' | 'ghost' | 'flat' | 'surface' | 'raised'

const paddings = {
  default: 'p-5',
  lg: 'p-6',
} as const

function resolveVariant(v: CardVariant): 'default' | 'elevated' | 'ghost' {
  if (v === 'flat' || v === 'ghost' || v === 'surface') return v === 'surface' ? 'ghost' : 'default'
  if (v === 'raised') return 'elevated'
  return v
}

const variantClasses: Record<'default' | 'elevated' | 'ghost', string> = {
  default: cn(
    'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)]',
    'shadow-[var(--shadow-xs)] text-[var(--text-primary)]'
  ),
  elevated: cn(
    'rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-app)]',
    'shadow-[var(--shadow-sm)] text-[var(--text-primary)]',
    'transition-[box-shadow,transform,border-color] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-out)]',
    'hover:shadow-[var(--shadow-lg)] hover:border-[var(--border-default)] hover:-translate-y-0.5'
  ),
  ghost: cn(
    'rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]',
    'text-[var(--text-primary)]'
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
        'text-[var(--text-20)] font-[500] leading-[var(--leading-heading)] tracking-[var(--tracking-heading)] text-[var(--text-primary)]',
        className
      )}
      {...props}
    />
  )
}

export { Card, CardTitle }
