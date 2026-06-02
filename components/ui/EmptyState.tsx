import type { ReactNode } from 'react'
import { Enso } from '@/components/icons/inked'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description?: ReactNode
  /** Defaults to the brass ensō hero mark. Pass a node (e.g. an inked <Icon>) to override. */
  icon?: ReactNode
  /** Optional CTA(s) — typically a <Button> or link. */
  action?: ReactNode
  className?: string
}

/**
 * Unified empty state — replaces the hand-rolled `.empty-state-coach` blocks
 * and the ad-hoc dashed-border empties across the coach pages.
 * Centered column, brass ensō, title + optional description + optional action.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-20 text-center', className)}>
      <div className="mb-5 flex items-center justify-center">{icon ?? <Enso size={72} />}</div>
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-[var(--text-tertiary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  )
}
