'use client'

import { usePathname } from 'next/navigation'

const HIDE_PREFIXES = ['/admin/system', '/admin/settings', '/admin/errors']

export function AdminWarningBanner() {
  const pathname = usePathname() ?? ''
  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null
  }
  return (
    <div
      className="mb-6 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[13px] text-[#991B1B]"
      role="status"
    >
      ⚠ Admin mode — you are viewing all coach data
    </div>
  )
}
