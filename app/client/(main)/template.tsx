'use client'

import { usePathname } from 'next/navigation'

export default function ClientMainTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="client-route-enter flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  )
}
