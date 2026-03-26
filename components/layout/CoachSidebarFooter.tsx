'use client'

import { CoachSidebarThemeFooter } from '@/components/layout/CoachSidebarThemeFooter'
import { SignOutButton } from '@/components/layout/SignOutButton'

/** Desktop coach sidebar bottom: dark mode + log out */
export function CoachSidebarFooter() {
  return (
    <div className="flex w-full flex-col">
      <CoachSidebarThemeFooter />
      <div className="border-t border-[var(--color-border)] px-2 pt-2">
        <SignOutButton variant="sidebar" />
      </div>
    </div>
  )
}
