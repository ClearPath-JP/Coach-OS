'use client'

import { usePathname } from 'next/navigation'

/** Re-mounts on route change; unified max width + padding + enter animation for every coach page. */
export default function CoachTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div
      key={pathname}
      className="page-content mx-auto flex min-h-0 w-full max-w-[var(--coach-content-max)] flex-1 flex-col px-[var(--coach-content-px-mobile)] pb-24 pt-[var(--coach-header-content-gap)] lg:px-[var(--coach-content-px)] lg:pb-8"
    >
      {children}
    </div>
  )
}
