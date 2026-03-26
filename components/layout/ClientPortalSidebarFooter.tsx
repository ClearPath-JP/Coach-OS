'use client'

import { SignOutButton } from '@/components/layout/SignOutButton'

/** Bottom of client desktop sidebar: sign out (client theme is in top Nav). */
export function ClientPortalSidebarFooter() {
  return (
    <div className="border-t border-[var(--color-border)] px-2 pt-2">
      <SignOutButton variant="sidebar" />
    </div>
  )
}
