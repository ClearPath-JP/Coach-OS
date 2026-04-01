'use client'

export interface PageHeaderProps {
  title: string
  breadcrumb?: string
  contextInfo?: string
  children?: React.ReactNode
}

export function PageHeader({ title, breadcrumb, contextInfo, children }: PageHeaderProps) {
  return (
    <div className="flex h-14 items-center border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {breadcrumb ?? title}
        </p>
      </div>
      {contextInfo ? (
        <div className="mx-3 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] text-[var(--text-tertiary)]">
          {contextInfo}
        </div>
      ) : null}
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}
