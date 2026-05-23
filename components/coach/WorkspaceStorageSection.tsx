'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type StoragePayload = {
  usedBytes: number
  videoBytes: number
  assignmentBytes: number
  otherBytes: number
  maxGb: number
  usedGb: number
  pct: number
}

function gbFromBytes(b: number): string {
  return (b / 1_000_000_000).toFixed(2)
}

export function WorkspaceStorageSection() {
  const [data, setData] = useState<StoragePayload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/coach/storage')
        const j = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setErr(j.error ?? 'Could not load storage')
          return
        }
        setData(j.data ?? { usedBytes: 0, videoBytes: 0, assignmentBytes: 0, otherBytes: 0, maxGb: 5, usedGb: 0, pct: 0 })
      } catch {
        if (!cancelled) setData({ usedBytes: 0, videoBytes: 0, assignmentBytes: 0, otherBytes: 0, maxGb: 5, usedGb: 0, pct: 0 })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading storage…</p>
  }

  const fillClass =
    data.pct >= 95
      ? 'bg-[var(--color-error)]'
      : data.pct >= 80
        ? 'bg-amber-500'
        : 'bg-[var(--color-accent)]'

  return (
    <div className="space-y-4 border-t border-[var(--color-border)] pt-6">
      <div>
        <h3 className="text-base font-medium text-[var(--color-text-primary)]">Storage</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Videos and assignment uploads count toward your workspace limit.
        </p>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-[var(--color-text-primary)]">Storage used</span>
          <span className="tabular-nums text-[var(--color-text-secondary)]">
            {data.usedGb.toFixed(1)} GB of {data.maxGb} GB ({data.pct}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className={cn('h-full rounded-full transition-all', fillClass)}
            style={{ width: `${Math.min(100, data.pct)}%` }}
          />
        </div>
      </div>
      <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
        <li className="flex justify-between gap-4">
          <span>Videos</span>
          <span className="tabular-nums">{gbFromBytes(data.videoBytes)} GB</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Assignments</span>
          <span className="tabular-nums">{gbFromBytes(data.assignmentBytes)} GB</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Other</span>
          <span className="tabular-nums">{gbFromBytes(data.otherBytes)} GB</span>
        </li>
      </ul>
      {data.pct > 60 ? (
        <Link
          href="/billing"
          className="inline-flex h-9 min-h-9 w-full items-center justify-center rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3.5 text-[14px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-all hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:shadow-[var(--shadow-sm)] sm:w-auto"
        >
          Upgrade for more storage
        </Link>
      ) : null}
    </div>
  )
}
