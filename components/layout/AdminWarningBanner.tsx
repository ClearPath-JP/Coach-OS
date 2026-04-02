'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Pages where the banner is hidden so ops / troubleshooting UIs stay calm. */
const HIDE_PREFIXES = ['/admin/system', '/admin/settings', '/admin/errors', '/admin/guide']

export function AdminWarningBanner() {
  const pathname = usePathname() ?? ''
  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null
  }
  return (
    <div
      className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-950"
      role="status"
    >
      <p className="font-medium text-amber-950">Platform admin mode</p>
      <p className="mt-1 text-amber-900/90">
        You can see <strong>every</strong> coach workspace and client — use this only for support and operations, not
        for day-to-day coaching.
      </p>
      <p className="mt-2">
        <Link href="/admin/guide" className="font-medium text-amber-900 underline decoration-amber-700/40 underline-offset-2 hover:decoration-amber-900">
          What does each page do?
        </Link>
        <span className="text-amber-800/80"> · </span>
        <Link href="/admin/guide#when-things-break" className="font-medium text-amber-900 underline decoration-amber-700/40 underline-offset-2 hover:decoration-amber-900">
          Something broken?
        </Link>
      </p>
    </div>
  )
}
