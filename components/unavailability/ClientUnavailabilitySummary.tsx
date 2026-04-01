'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatBlockSummary, type WeeklyUnavailabilityBlock } from '@/lib/weekly-unavailability'

/**
 * Read-only hints on client Sessions: coach vs client typical unavailability.
 */
export function ClientUnavailabilitySummary() {
  const [coachBlocks, setCoachBlocks] = useState<WeeklyUnavailabilityBlock[]>([])
  const [myBlocks, setMyBlocks] = useState<WeeklyUnavailabilityBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/client/weekly-unavailability', { credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        setCoachBlocks((json.data?.coachBlocks ?? []) as WeeklyUnavailabilityBlock[])
        setMyBlocks((json.data?.myBlocks ?? []) as WeeklyUnavailabilityBlock[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="h-16 animate-pulse rounded-xl bg-[var(--color-surface)]" aria-hidden />
  }

  const hasCoach = coachBlocks.length > 0
  const hasMine = myBlocks.length > 0
  if (!hasCoach && !hasMine) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hasCoach ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <p className="text-[13px] font-medium text-[var(--color-ink)]">Coach usually not available</p>
          <ul className="mt-2 space-y-1 text-[13px] text-[var(--color-muted)]">
            {coachBlocks.map((b) => (
              <li key={b.id}>{formatBlockSummary(b)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasMine ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
          <p className="text-[13px] font-medium text-[var(--color-ink)]">You usually not available</p>
          <ul className="mt-2 space-y-1 text-[13px] text-[var(--color-muted)]">
            {myBlocks.map((b) => (
              <li key={b.id}>{formatBlockSummary(b)}</li>
            ))}
          </ul>
          <Link href="/client/profile" className="link-nav mt-2 inline-block text-[12px] font-medium">
            Edit in Settings
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-[13px] text-[var(--color-muted)]">
            Share when you&apos;re usually busy so your coach can plan —{' '}
            <Link href="/client/profile" className="link-nav font-medium">
              set in Settings
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  )
}
