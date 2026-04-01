'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatAuditDescription, type AuditDisplayContext } from '@/lib/admin-audit-messages'
import type { AdminOverviewActivityEvent } from '@/lib/admin-overview-data'

function borderClass(border: 'security' | 'payment' | 'default'): string {
  if (border === 'security') return 'border-l-red-500'
  if (border === 'payment') return 'border-l-emerald-600'
  return 'border-l-transparent'
}

export function AdminOverviewActivityFeed({ events }: { events: AdminOverviewActivityEvent[] }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-slate-900">Recent activity</h2>
      <ul className="mt-3 max-h-[min(70vh,640px)] space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <li className="text-sm text-slate-500">No recent events yet.</li>
        ) : (
          events.map((ev) => {
            const ctx: AuditDisplayContext = {
              actorName: ev.actorName,
              actorEmail: ev.actorEmail,
              workspaceName: ev.workspaceName,
              targetEmail: typeof ev.metadata.email === 'string' ? ev.metadata.email : null,
              ip: ev.ip,
              coachLabel: ev.workspaceName ?? null,
            }
            const { segments, border } = formatAuditDescription(ev.action, ev.metadata, ctx)
            return (
              <li
                key={ev.id}
                className={`border-l-[3px] ${borderClass(border)} rounded-r-lg bg-slate-50/80 py-2 pl-3 pr-2`}
              >
                <p className="text-[13px] leading-snug text-slate-800">
                  {segments.map((s, i) =>
                    s.bold ? (
                      <strong key={i} className="font-semibold text-slate-900">
                        {s.text}
                      </strong>
                    ) : (
                      <span key={i}>{s.text}</span>
                    )
                  )}
                </p>
                {ev.workspaceName ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">{ev.workspaceName}</p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-500">Platform</p>
                )}
                <p className="text-[11px] text-slate-400">
                  {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                </p>
              </li>
            )
          })
        )}
      </ul>
      <Link
        href="/admin/audit"
        className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline"
      >
        View full audit log
      </Link>
    </div>
  )
}
