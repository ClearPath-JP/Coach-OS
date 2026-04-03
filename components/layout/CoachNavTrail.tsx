'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

function segmentTitle(pathname: string): string {
  if (pathname === '/billing' || pathname.startsWith('/billing?')) return 'Billing'
  if (pathname === '/coach/dashboard') return 'Dashboard'
  if (pathname.startsWith('/coach/clients')) return 'Clients'
  if (pathname.startsWith('/coach/schedule')) return 'Schedule'
  if (pathname.startsWith('/coach/programs')) return 'Programs'
  if (pathname.startsWith('/coach/videos')) return 'Videos'
  if (pathname.startsWith('/coach/messages')) return 'Messages'
  if (pathname.startsWith('/coach/packages')) return 'Packages'
  if (pathname.startsWith('/coach/invoices')) return 'Invoices'
  if (pathname.startsWith('/coach/payments')) return 'Payments'
  if (pathname.startsWith('/coach/analytics')) return 'Analytics'
  if (pathname.startsWith('/coach/settings')) return 'Settings'
  if (pathname.startsWith('/coach/assignments')) return 'Assignments'
  if (pathname.startsWith('/coach')) return 'Coach'
  return ''
}

export function CoachNavTrail() {
  const pathname = usePathname() ?? ''
  const [detailLabel, setDetailLabel] = useState<string | null>(null)

  const clientMatch = pathname.match(/^\/coach\/clients\/([^/]+)$/)
  const programMatch = pathname.match(/^\/coach\/programs\/([^/]+)$/)
  const detailId = clientMatch?.[1] ?? programMatch?.[1] ?? null
  const isClientDetail = Boolean(clientMatch)
  const isProgramDetail = Boolean(programMatch)

  useEffect(() => {
    if (!detailId || detailId === 'new') return
    if (!isClientDetail && !isProgramDetail) return
    let cancelled = false
    const url = isClientDetail
      ? `/api/clients/${encodeURIComponent(detailId)}`
      : `/api/programs/${encodeURIComponent(detailId)}`
    void fetch(url, { credentials: 'include' })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (cancelled || !r.ok) return
        if (isClientDetail && j.data) {
          const d = j.data as { first_name?: string | null; last_name?: string | null; email?: string | null }
          const n = [d.first_name, d.last_name].filter(Boolean).join(' ').trim()
          setDetailLabel(n || d.email?.trim() || 'Client')
        } else if (isProgramDetail && j.data) {
          const p = j.data as { title?: string | null }
          setDetailLabel(p.title?.trim() || 'Program')
        }
      })
      .catch(() => {
        if (!cancelled) setDetailLabel(null)
      })
    return () => {
      cancelled = true
    }
  }, [detailId, isClientDetail, isProgramDetail])

  const parent = segmentTitle(pathname)
  const showTrail = Boolean(detailId && detailId !== 'new' && parent && detailLabel)

  if (showTrail) {
    return (
      <nav className="flex min-w-0 items-center gap-2 text-[14px] font-medium" aria-label="Breadcrumb">
        {isClientDetail ? (
          <Link href="/coach/clients" className="shrink-0 text-[var(--text-tertiary)] transition-colors duration-100 hover:text-[var(--text-secondary)]">
            {parent}
          </Link>
        ) : (
          <Link href="/coach/programs" className="shrink-0 text-[var(--text-tertiary)] transition-colors duration-100 hover:text-[var(--text-secondary)]">
            {parent}
          </Link>
        )}
        <span className="shrink-0 text-[var(--text-quaternary)]" aria-hidden>
          /
        </span>
        <span className="min-w-0 truncate text-[var(--text-primary)]">{detailLabel}</span>
      </nav>
    )
  }

  const single = parent || segmentTitle(pathname) || 'Coach'
  return (
    <h1 className="min-w-0 truncate text-[14px] font-medium text-[var(--text-primary)]">{single}</h1>
  )
}
