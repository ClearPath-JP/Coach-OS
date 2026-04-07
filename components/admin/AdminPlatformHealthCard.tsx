'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'

type Summary = {
  platformHealthOk: boolean
  checkedAt: string
  failing: string[]
}

export function AdminPlatformHealthCard({
  initialOk,
  initialCheckedAt,
}: {
  initialOk: boolean
  initialCheckedAt: string
}) {
  const [live, setLive] = useState<Summary>({
    platformHealthOk: initialOk,
    checkedAt: initialCheckedAt,
    failing: [],
  })

  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch('/api/admin/system?summary=1')
        const json = await r.json()
        const d = json.data as Partial<Summary> | undefined
        if (d?.checkedAt) {
          setLive({
            platformHealthOk: Boolean(d.platformHealthOk),
            checkedAt: d.checkedAt,
            failing: Array.isArray(d.failing) ? d.failing : [],
          })
        }
      } catch {
        // keep last good snapshot
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 45_000)
    return () => clearInterval(id)
  }, [])

  const rel = formatDistanceToNow(new Date(live.checkedAt), { addSuffix: true })

  return (
    <Link
      href="/admin/system"
      className={`block rounded-xl border border-[var(--border-default)] border-l-4 bg-[var(--bg-app)] p-4 shadow-sm transition-colors hover:bg-[var(--bg-subtle)] ${
        live.platformHealthOk ? 'border-l-emerald-500' : 'border-l-red-500'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Platform health</p>
          <p
            className={`mt-1 text-2xl font-semibold ${live.platformHealthOk ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {live.platformHealthOk ? 'Healthy' : 'Issues found'}
          </p>
          <p className="mt-1 text-xs text-slate-500">Updated {rel}</p>
          {!live.platformHealthOk && live.failing.length > 0 ? (
            <p className="mt-1 text-[11px] text-red-700">
              Check: {live.failing.join(', ')}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-medium text-blue-600">Open system dashboard →</p>
        </div>
        <span className="text-2xl" aria-hidden>
          💓
        </span>
      </div>
    </Link>
  )
}
