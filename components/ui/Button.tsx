'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'accentGhost'
  /** @deprecated Use accentGhost */
  | 'ghost-link'
  | 'danger'
  /** @deprecated Use danger */
  | 'destructive'
  | 'destructive-secondary'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

function Spinner({ className, sizePx }: { className?: string; sizePx: number }) {
  return (
    <svg
      className={cn('shrink-0 animate-spin', className)}
      width={sizePx}
      height={sizePx}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

const base = cn(
  'relative inline-flex items-center justify-center border-[1.5px] border-transparent font-medium tracking-[-0.01em]',
  'rounded-[var(--radius-md)] cursor-pointer select-none whitespace-nowrap gap-[6px]',
  'transition-all duration-[var(--duration-normal)] [transition-timing-function:var(--ease-out)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none'
)

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 min-h-7 gap-1 px-2.5 text-[12px]',
  sm: 'h-8 min-h-8 gap-1 px-3 text-[13px]',
  md: 'h-9 min-h-9 px-3.5 text-[14px]',
  lg: 'h-10 min-h-10 px-[18px] text-[15px]',
  xl: 'h-12 min-h-12 px-6 text-[15px]',
}

const variantClasses: Record<
  'primary' | 'secondary' | 'ghost' | 'accentGhost' | 'danger' | 'destructive-secondary',
  string
> = {
  primary: cn(
    'bg-[var(--accent)] text-[var(--text-on-accent)] border-transparent',
    'shadow-[var(--shadow-xs),inset_0_1px_0_rgba(255,255,255,0.15)]',
    'hover:bg-[var(--accent-hover)] hover:-translate-y-px hover:shadow-[var(--shadow-md)]',
    'active:translate-y-0 active:shadow-[var(--shadow-xs)]',
    'disabled:hover:bg-[var(--accent)]'
  ),
  secondary: cn(
    'bg-[var(--bg-app)] text-[var(--text-primary)] border-[var(--border-default)]',
    'shadow-[var(--shadow-xs)]',
    'hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] hover:-translate-y-px hover:shadow-[var(--shadow-sm)]',
    'active:translate-y-0',
    'disabled:hover:bg-[var(--bg-app)]'
  ),
  ghost: cn(
    'bg-transparent text-[var(--text-tertiary)] border-transparent shadow-none',
    'hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
    'active:translate-y-0'
  ),
  accentGhost: cn(
    'bg-[var(--accent-light)] text-[var(--accent)] border-transparent shadow-none',
    'hover:bg-[var(--accent-muted)]',
    'active:translate-y-0'
  ),
  danger: cn(
    'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)] shadow-none',
    'hover:bg-[var(--error)] hover:text-white hover:border-[var(--error)]',
    'active:translate-y-0'
  ),
  'destructive-secondary': cn(
    'bg-transparent text-[var(--error)] border-[var(--error)] shadow-none',
    'hover:bg-[var(--error-bg)]',
    'active:translate-y-0'
  ),
}

function resolveVariant(v: ButtonVariant): keyof typeof variantClasses {
  if (v === 'destructive') return 'danger'
  if (v === 'ghost-link') return 'accentGhost'
  return v
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading = false,
      type = 'button',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const v = resolveVariant(variant)
    const spinnerPx = size === 'lg' || size === 'xl' ? 14 : 12

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          base,
          sizeClasses[size],
          variantClasses[v],
          fullWidth && 'w-full',
          loading && 'opacity-75',
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span className="invisible inline-flex items-center gap-[6px]">{children}</span>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Spinner sizePx={spinnerPx} />
            </span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
