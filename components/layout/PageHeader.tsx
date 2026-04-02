'use client'

export interface PageHeaderProps {
  title: string
  breadcrumb?: string
  contextInfo?: string
  children?: React.ReactNode
}

export function PageHeader({ title, breadcrumb, contextInfo, children }: PageHeaderProps) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-y-2 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-6 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
          {breadcrumb ?? title}
        </p>
      </div>
      {contextInfo ? (
        <div className="mx-3 max-w-full shrink-0 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[var(--text-13)] text-[var(--text-tertiary)]">
          {contextInfo}
        </div>
      ) : null}
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}
