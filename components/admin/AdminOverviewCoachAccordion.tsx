'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AdminOverviewClientRow } from '@/lib/admin-overview-data'

type WorkspaceRow = {
  workspaceId: string
  workspaceName: string
  coachEmail: string
  plan: string
  statusLabel: 'Active' | 'Trial' | 'Paused'
  clientsCount: number
  lastActive: string | null
  revenueThisMonthCents: number
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]!
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]!
  return (first[0]! + last[0]!).toUpperCase()
}

function planBadgeClass(plan: string): string {
  const p = plan.toLowerCase()
  if (p === 'scale') return 'bg-violet-100 text-violet-800'
  if (p === 'pro') return 'bg-blue-100 text-blue-800'
  if (p === 'starter') return 'bg-sky-100 text-sky-800'
  return 'bg-slate-100 text-slate-700'
}

function statusDotClass(label: WorkspaceRow['statusLabel']): string {
  if (label === 'Trial') return 'bg-amber-500'
  if (label === 'Paused') return 'bg-slate-400'
  return 'bg-emerald-500'
}

export function AdminOverviewCoachAccordion({
  workspaces,
  clientsByWorkspace,
}: {
  workspaces: WorkspaceRow[]
  clientsByWorkspace: Record<string, AdminOverviewClientRow[]>
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {workspaces.map((w) => {
        const clients = clientsByWorkspace[w.workspaceId] ?? []
        const isOpen = open.has(w.workspaceId)
        return (
          <div
            key={w.workspaceId}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggle(w.workspaceId)}
              className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-slate-50/80 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-slate-900">{w.workspaceName}</p>
                <p className="text-[13px] text-slate-500">{w.coachEmail}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-center">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${planBadgeClass(w.plan)}`}
                >
                  {w.plan}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {w.clientsCount} clients
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(w.statusLabel)}`} />
                  {w.statusLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{money(w.revenueThisMonthCents)}</p>
                  <p className="text-[11px] text-slate-500">this month</p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  Last active
                  <br />
                  {w.lastActive
                    ? formatDistanceToNow(new Date(w.lastActive), { addSuffix: true })
                    : '—'}
                </div>
                <Link
                  href={`/admin/coaches/${w.workspaceId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-7 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  Manage →
                </Link>
                <span className="text-slate-400" aria-hidden>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-slate-100 bg-[#F1F5F9] px-4 py-3 pl-8">
                <div className="border-l-[3px] border-blue-200 pl-4">
                  {clients.length === 0 ? (
                    <p className="text-sm text-slate-500">No clients yet</p>
                  ) : (
                    <ul className="space-y-3">
                      {clients.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-start gap-3 border-b border-slate-200/80 pb-3 last:border-0 last:pb-0"
                        >
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-800"
                            aria-hidden
                          >
                            {initials(c.displayName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{c.displayName}</p>
                            <p className="text-xs text-slate-500">{c.email ?? '—'}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                              <span className="rounded-full bg-white px-2 py-0.5 capitalize">{c.status}</span>
                              <span>{c.sessionsCount} sessions</span>
                              <span>{c.programName ?? 'None'}</span>
                              <span>Joined {new Date(c.joinedAt).toLocaleDateString()}</span>
                              <span>
                                Last active{' '}
                                {c.lastActiveAt
                                  ? formatDistanceToNow(new Date(c.lastActiveAt), { addSuffix: true })
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/admin/coaches/${w.workspaceId}`}
                    className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline"
                  >
                    View full workspace →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
