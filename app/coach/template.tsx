'use client'

import { usePathname } from 'next/navigation'

/** Re-mounts on route change for a short enter transition between coach pages. */
export default function CoachTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="coach-route-enter flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  )
}
