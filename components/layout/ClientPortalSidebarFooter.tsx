'use client'

/** Desktop client sidebar: white-label attribution only (Log out is in the top bar and on Profile). */
export function ClientPortalSidebarFooter() {
  return (
    <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 py-3">
      <p className="text-center text-[12px] leading-snug text-[var(--text-quaternary)]">
        Powered by <span className="font-medium text-[var(--cp-accent)]">FoundOS</span>
      </p>
    </div>
  )
}
