'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/Input'

type CoachRow = {
  workspaceId: string
  workspaceName: string
  coachName: string
  email: string
  plan: string
  status: string
  workspaceStatus: string
  clients: number
  maxClients: number
  lastActiveAt: string | null
  joined: string
  revenueThisMonthCents: number
  sessionsCount: number
  storageUsedBytes: number
  maxVideoStorageGb: number
}

type Tab = 'all' | 'active' | 'trial' | 'past_due' | 'cancelled' | 'free'

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function bytesToGb(n: number): string {
  return (n / (1024 * 1024 * 1024)).toFixed(1)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]!
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]!
  return (first[0]! + last[0]!).toUpperCase()
}

function planBadge(plan: string): string {
  const p = plan.toLowerCase()
  if (p === 'scale') return 'bg-violet-100 text-violet-800'
  if (p === 'pro') return 'bg-blue-100 text-blue-800'
  if (p === 'starter') return 'bg-sky-100 text-sky-800'
  return 'bg-slate-100 text-slate-700'
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'suspended' || status === 'past_due'
      ? 'bg-red-100 text-red-800'
      : status === 'trial'
        ? 'bg-amber-100 text-amber-900'
        : status === 'cancelled'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-emerald-100 text-emerald-800'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${color}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (tab === 'free') params.set('plan', 'free')
    else if (tab !== 'all') params.set('status', tab)
    void fetch(`/api/admin/coaches?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setRows(json.data ?? []))
  }, [search, tab])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const close = () => setOpenMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'active', label: 'Active' },
      { id: 'trial', label: 'Trial' },
      { id: 'past_due', label: 'Past due' },
      { id: 'cancelled', label: 'Cancelled' },
      { id: 'free', label: 'Free plan' },
    ],
    []
  )

  const copyEmail = (email: string) => {
    void navigator.clipboard.writeText(email)
  }

  const extendTrial = async (workspaceId: string) => {
    const res = await fetch(`/api/admin/coaches/${workspaceId}/extend-trial`, { method: 'POST' })
    if (res.ok) refresh()
  }

  const changePlan = async (workspaceId: string, plan: string) => {
    if (!window.confirm(`Change this workspace to the ${plan} plan?`)) return
    await fetch(`/api/admin/coaches/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    refresh()
  }

  const suspend = async (workspaceId: string, name: string) => {
    if (!window.confirm(`Suspend workspace “${name}”? The coach will lose access until you reactivate.`)) return
    await fetch(`/api/admin/coaches/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceStatus: 'suspended' }),
    })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900">
            {rows ? `${rows.length} coaches` : 'Coaches'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Every coaching business on the platform. Search by name or email, filter by billing status, then open a
            card for details, trial extension, plan changes, or suspend.
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workspace or email…"
          className="w-full max-w-md"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows == null ? (
        <p className="text-sm text-slate-500">Loading coaches…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-900">No coaches match</p>
          <p className="mt-1 text-sm text-slate-600">Try another search or tab.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const storageGb = bytesToGb(r.storageUsedBytes)
            const storagePct = r.maxVideoStorageGb > 0 ? Number(storageGb) / r.maxVideoStorageGb : 0
            const storageWarn = storagePct >= 0.8
            return (
              <article
                key={r.workspaceId}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[17px] font-medium text-slate-900">{r.workspaceName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${planBadge(r.plan)}`}>
                        {r.plan}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-700"
                    aria-hidden
                  >
                    {initials(r.coachName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{r.coachName}</p>
                    <button
                      type="button"
                      onClick={() => copyEmail(r.email)}
                      className="text-left text-xs text-blue-600 hover:underline"
                      title="Copy email"
                    >
                      {r.email}
                    </button>
                    <p className="mt-1 text-xs text-slate-500">
                      Joined{' '}
                      {new Date(r.joined).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
                  <span title="Clients">👥 {r.clients}</span>
                  <span title="Sessions">📅 {r.sessionsCount}</span>
                  <span title="Revenue this month">💰 {money(r.revenueThisMonthCents)}</span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      Storage: {storageGb} GB / {r.maxVideoStorageGb} GB
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${storageWarn ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, storagePct * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <Link
                    href={`/admin/coaches/${r.workspaceId}#clients`}
                    className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    View clients
                  </Link>
                  <Link
                    href={`/admin/coaches/${r.workspaceId}`}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    Manage
                  </Link>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu((id) => (id === r.workspaceId ? null : r.workspaceId))
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      aria-label="More actions"
                    >
                      ⋯
                    </button>
                    {openMenu === r.workspaceId ? (
                      <div
                        className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`mailto:${encodeURIComponent(r.email)}`}
                          className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                        >
                          Send email
                        </a>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                          onClick={() => {
                            setOpenMenu(null)
                            void extendTrial(r.workspaceId)
                          }}
                        >
                          Extend trial (+14 days)
                        </button>
                        <div className="border-t border-slate-100 px-3 py-2 text-[11px] font-medium uppercase text-slate-500">
                          Change plan
                        </div>
                        {(['free', 'starter', 'pro', 'scale'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm capitalize text-slate-800 hover:bg-slate-50"
                            onClick={() => {
                              setOpenMenu(null)
                              void changePlan(r.workspaceId, p)
                            }}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50"
                          onClick={() => {
                            setOpenMenu(null)
                            void suspend(r.workspaceId, r.workspaceName)
                          }}
                        >
                          Suspend
                        </button>
                        <Link
                          href={`/admin/coaches/${r.workspaceId}`}
                          className="block px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                          onClick={() => setOpenMenu(null)}
                        >
                          Delete…
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Last active:{' '}
                  {r.lastActiveAt
                    ? formatDistanceToNow(new Date(r.lastActiveAt), { addSuffix: true })
                    : '—'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
