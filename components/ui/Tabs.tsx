'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  /** Optional trailing count, e.g. "Active 12". */
  count?: number
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the tablist. */
  ariaLabel?: string
  className?: string
}

/**
 * Shared underline tab strip — extracts the identical
 * `h-9 px-4 … after:h-0.5 after:bg-[var(--cp-accent)]` pattern hand-rolled
 * across 8 pages. The active underline uses `--cp-accent`, which resolves to
 * brass on coach surfaces and to the workspace stance on the client portal.
 * Renders only the strip; callers render the active panel below it.
 */
export function Tabs<T extends string = string>({ tabs, value, onChange, ariaLabel, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-0 border-b border-[var(--border-subtle)]', className)}
    >
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative h-9 px-4 text-[14px] transition-colors duration-150',
              active
                ? 'font-medium text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--cp-accent)]'
                : 'font-normal text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            {t.label}
            {typeof t.count === 'number' ? (
              <span className="ml-1.5 text-[12px] text-[var(--text-tertiary)]">{t.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
