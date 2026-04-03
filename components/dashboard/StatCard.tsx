'use client'

import React, { type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { CountUpValue } from '@/components/ui/CountUpValue'

export interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  subtextPositive?: boolean
  icon?: ReactNode
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
  icon,
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--cp-gray)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {icon ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--cp-lavender)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cp-accent)',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: 'var(--cp-navy)',
          lineHeight: 1.1,
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
            color:
              subtextPositive === true ? '#15803D' : subtextPositive === false ? '#B91C1C' : 'var(--cp-gray)',
            marginTop: 2,
          }}
        >
          {subtext}
        </div>
      ) : null}
      {footer}
    </>
  )

  const shellProps: {
    style: CSSProperties
    onMouseEnter: (e: MouseEvent<HTMLDivElement>) => void
    onMouseLeave: (e: MouseEvent<HTMLDivElement>) => void
  } = {
    style: {
      background: 'var(--cp-white)',
      border: '1px solid var(--cp-border)',
      borderRadius: 12,
      padding: '20px 22px',
      cursor: interactive ? ('pointer' as const) : ('default' as const),
      transition: 'border-color 0.15s',
      display: 'flex' as const,
      flexDirection: 'column' as const,
      gap: 4,
      minWidth: 0,
    },
    onMouseEnter: (e: MouseEvent<HTMLDivElement>) => {
      if (interactive) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cp-accent)'
    },
    onMouseLeave: (e: MouseEvent<HTMLDivElement>) => {
      if (interactive) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cp-border)'
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
