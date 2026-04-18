'use client'

import React, { type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { CountUpValue } from '@/components/ui/CountUpValue'

export interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  subtextPositive?: boolean
  onClick?: () => void
  href?: string
  /** When value is numeric, animate count-up */
  animateValue?: boolean
  animateOnce?: boolean
  formatAnimated?: (n: number) => string
  /** Extra row below subtext (e.g. progress bar) */
  footer?: ReactNode
}

export const StatCard = React.memo(function StatCard({
  label,
  value,
  subtext,
  subtextPositive,
  onClick,
  href,
  animateValue,
  animateOnce,
  formatAnimated,
  footer,
}: StatCardProps) {
  const interactive = Boolean(onClick || href)

  const cardInner = (
    <>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
          display: 'block',
        }}
      >
        {label}
      </span>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {animateValue && typeof value === 'number' ? (
          <CountUpValue
            value={value}
            durationMs={600}
            animateOnce={animateOnce ?? false}
            {...(formatAnimated ? { formatter: formatAnimated } : {})}
          />
        ) : (
          value
        )}
      </div>
      {subtext ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            marginTop: 6,
            color:
              subtextPositive === true
                ? 'var(--success)'
                : subtextPositive === false
                  ? 'var(--error)'
                  : 'var(--text-tertiary)',
          }}
        >
          {subtext}
        </div>
      ) : null}
      {footer}
    </>
  )

  const shellProps: {
    className: string
    style: CSSProperties
    onMouseEnter: (e: MouseEvent<HTMLDivElement>) => void
    onMouseLeave: (e: MouseEvent<HTMLDivElement>) => void
  } = {
    className: 'card-glow',
    style: {
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      padding: '14px 16px',
      cursor: interactive ? ('pointer' as const) : ('default' as const),
      transition: 'border-color 0.3s var(--ease-default), background-color 0.3s var(--ease-default), box-shadow 0.3s var(--ease-default), transform 0.3s var(--ease-default)',
      display: 'flex' as const,
      flexDirection: 'column' as const,
      minWidth: 0,
    },
    onMouseEnter: (e: MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--border-strong)'
        el.style.background = 'var(--bg-muted)'
        el.style.transform = 'translateY(-2px)'
      }
    },
    onMouseLeave: (e: MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--border-default)'
        el.style.background = 'var(--bg-subtle)'
        el.style.transform = 'translateY(0)'
      }
    },
  }

  if (href) {
    return (
      <Link href={href} className="block min-w-0 no-underline" style={{ color: 'inherit' }}>
        <div {...shellProps}>{cardInner}</div>
      </Link>
    )
  }

  return (
    <div {...shellProps} onClick={onClick} role={onClick ? 'button' : undefined}>
      {cardInner}
    </div>
  )
})
