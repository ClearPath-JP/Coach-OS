'use client'

export interface PageHeaderProps {
  title: string
  breadcrumb?: string
  /** @deprecated Prefer `countLabel` */
  contextInfo?: string
  /** e.g. "12 items" — muted pill next to title */
  countLabel?: string
  children?: React.ReactNode
}

export function PageHeader({ title, breadcrumb, contextInfo, countLabel, children }: PageHeaderProps) {
  const pill = countLabel ?? contextInfo
  return (
    <header className="section-header-glow sticky top-0 z-20 -mx-[var(--coach-content-px-mobile)] mb-[var(--coach-header-content-gap)] flex h-[var(--coach-header-height)] shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-[var(--coach-content-px-mobile)] lg:-mx-[var(--coach-content-px)] lg:px-[var(--coach-content-px)]">
      <div className="flex min-w-0 flex-1 items-center">
        <h1 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
          {breadcrumb ?? title}
        </h1>
        {pill ? (
          <span className="ml-[10px] shrink-0 rounded-full bg-[var(--bg-muted)] px-2 py-[2px] text-[12px] text-[var(--text-tertiary)]">
            {pill}
          </span>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  )
}
