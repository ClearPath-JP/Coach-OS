'use client'

import { usePathname } from 'next/navigation'

/** Re-mounts on route change; unified padding + enter animation for every coach page. */
export default function CoachTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div
      key={pathname}
      className="page-content mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8"
    >
      {children}
    </div>
  )
}
