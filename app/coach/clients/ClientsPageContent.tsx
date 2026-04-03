'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { StatusDot } from '@/components/ui/StatusDot'
import { QuickInvoiceModal } from '@/components/coach/QuickInvoiceModal'
import { Tooltip } from '@/components/ui/Tooltip'
import { calculateEngagementScore, engagementLabelText } from '@/lib/client-engagement'
import { AddClientModal } from './AddClientModal'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

type Engagement = ReturnType<typeof calculateEngagementScore>

type Client = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  goals: string | null
  status: string
  notes: string | null
  profile_photo_url: string | null
  created_at: string
  updated_at: string
  rewards?: {
    total_xp: number
    level: number
    last_activity_at?: string | null
    assignments_completed?: number
    assignments_total?: number
    current_streak_days?: number
  } | null
  sessionsCompletedCount?: number
  activeProgramTitle?: string | null
  engagement?: Engagement
}

type StatusFilter = '' | 'active' | 'paused' | 'completed'
type ViewMode = 'grid' | 'list'

function getInitials(first: string | null, last: string | null, email: string | null): string {
  if (first?.trim() || last?.trim()) {
    const a = (first?.trim() ?? '').slice(0, 1).toUpperCase()
    const b = (last?.trim() ?? '').slice(0, 1).toUpperCase()
    if (a || b) return `${a}${b}`
  }
  if (email?.trim()) return email.trim().slice(0, 2).toUpperCase()
  return '?'
}

function statusTone(status: string): 'active' | 'pending' | 'inactive' {
  if (status === 'active') return 'active'
  if (status === 'paused') return 'pending'
  return 'inactive'
}

function engagementThumbClass(label: 'engaged' | 'moderate' | 'at-risk' | undefined): string {
  if (label === 'engaged') {
    return 'bg-[linear-gradient(135deg,var(--accent-light)_0%,var(--bg-muted)_100%)]'
  }
  if (label === 'moderate') {
    return 'bg-[linear-gradient(135deg,var(--warning-bg)_0%,var(--bg-muted)_100%)]'
  }
  return 'bg-[linear-gradient(135deg,var(--error-bg)_0%,var(--bg-muted)_100%)]'
}

function statusDotClass(status: string): string {
  if (status === 'active') return 'bg-[var(--success)]'
  if (status === 'paused') return 'bg-[var(--warning)]'
  return 'bg-[var(--error)]'
}

function lastActiveLabel(client: Client): string {
  const last = client.rewards?.last_activity_at
  if (last) return formatDistanceToNow(new Date(last), { addSuffix: true })
  if (client.updated_at) return formatDistanceToNow(new Date(client.updated_at), { addSuffix: true })
  return '—'
}

export function CoachClientsPageContent() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [view, setView] = useState<ViewMode>('grid')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false)
  const [quickInvoiceClientId, setQuickInvoiceClientId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/clients?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load clients')
        setClients([])
        return
      }
      setClients(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 320)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const msg = sessionStorage.getItem('clearpath_clients_toast')
      if (msg) {
        sessionStorage.removeItem('clearpath_clients_toast')
        setToast(msg)
        timeout = setTimeout(() => setToast(null), 4000)
      }
    } catch {
      /* ignore */
    }
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  const handleAddSuccess = () => {
    setToast('Client added')
    fetchClients()
    setTimeout(() => setToast(null), 4000)
  }

  const tabCounts = useMemo(() => {
    return {
      all: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      paused: clients.filter((c) => c.status === 'paused').length,
      completed: clients.filter((c) => c.status === 'completed').length,
    }
  }, [clients])

  const displayedClients = useMemo(() => {
    if (!statusFilter) return clients
    return clients.filter((c) => c.status === statusFilter)
  }, [clients, statusFilter])

  const visibleClients = displayedClients

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ]

  const deleteClient = async (client: Client) => {
    const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || 'this client'
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(typeof json.error === 'string' ? json.error : 'Could not delete client')
        return
      }
      setToast('Client removed')
      setOpenMenuId(null)
      fetchClients()
    } catch {
      setToast('Could not delete client — try again')
    }
  }

  const columns: DataColumn<Client>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortValue: (r) => `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
        render: (client) => {
          const e = client.engagement
          const label = e?.label
          return (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
                  engagementThumbClass(label)
                )}
              >
                {getInitials(client.first_name, client.last_name, client.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{[client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'}</p>
                <p className="truncate text-[12px] text-[var(--text-tertiary)]">{client.email || '—'}</p>
              </div>
            </div>
          )
        },
      },
      {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status,
        render: (client) => (
          <span className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <StatusDot tone={statusTone(client.status)} />
            {client.status}
          </span>
        ),
      },
      {
        key: 'engagement',
        header: 'Engagement',
        sortValue: (r) => r.engagement?.score ?? 0,
        render: (client) => {
          const e = client.engagement
          if (!e) return <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
          const dot = e.label === 'engaged' ? '🟢' : e.label === 'moderate' ? '🟡' : '🔴'
          const last = client.rewards?.last_activity_at
          const done = client.rewards?.assignments_completed ?? 0
          const total = client.rewards?.assignments_total ?? 0
          const streak = client.rewards?.current_streak_days ?? 0
          const activeLine = last ? `Active ${formatDistanceToNow(new Date(last), { addSuffix: true })}` : 'No recent activity logged'
          const tip = `${activeLine} · ${done}/${total} assignments complete · ${streak}-day streak`
          const label = engagementLabelText(e.label)
          return (
            <Tooltip content={tip}>
              <span className="inline-flex cursor-default items-center gap-1.5 text-[13px] font-medium" style={{ color: e.color }}>
                <span aria-hidden>{dot}</span>
                {label}
              </span>
            </Tooltip>
          )
        },
      },
      {
        key: 'xp',
        header: 'XP',
        sortValue: (r) => r.rewards?.total_xp ?? 0,
        render: (client) => (
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-[13px] text-[var(--text-primary)]">{client.rewards?.total_xp ?? 0}</span>
            <Badge variant="accent">L{client.rewards?.level ?? 1}</Badge>
          </div>
        ),
      },
      {
        key: 'sessions',
        header: 'Sessions',
        sortValue: (r) => r.sessionsCompletedCount ?? 0,
        render: (client) => {
          const n = client.sessionsCompletedCount ?? 0
          return (
            <span className="text-[13px] text-[var(--text-primary)]">
              <span className="tabular-nums font-medium">{n}</span>
              <span className="text-[var(--text-tertiary)]"> {n === 1 ? 'session' : 'sessions'}</span>
            </span>
          )
        },
      },
      {
        key: 'program',
        header: 'Program',
        sortValue: (r) => r.activeProgramTitle ?? '',
        render: (client) => (
          <span className="line-clamp-2 text-[13px] text-[var(--text-primary)]">
            {client.activeProgramTitle?.trim() ? client.activeProgramTitle : 'None'}
          </span>
        ),
      },
      {
        key: 'lastActive',
        header: 'Last active',
        sortValue: (r) => r.updated_at,
        render: (client) => (
          <span className="text-[13px] text-[var(--text-tertiary)]">
            {client.updated_at ? formatDistanceToNow(new Date(client.updated_at), { addSuffix: true }) : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (client) => (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Link href={`/coach/messages?clientId=${encodeURIComponent(client.id)}`} className="text-[13px] font-medium text-[var(--accent)] hover:underline">
              Message
            </Link>
            <details className="relative">
              <summary className="cursor-pointer list-none text-[18px] leading-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">···</summary>
              <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] py-1 shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  onClick={() => {
                    setQuickInvoiceClientId(client.id)
                    setQuickInvoiceOpen(true)
                  }}
                >
                  Quick invoice
                </button>
              </div>
            </details>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <>
      <div className="coach-route-enter px-6 pb-10 pt-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">Clients</h1>
            <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[13px] text-[var(--text-tertiary)]">
              {clients.length} clients
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              placeholder="Search clients..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search clients"
              className="h-9 w-[240px] max-w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[14px]"
            />
            <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-default)] p-0.5">
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                className={cn(
                  'flex size-8 items-center justify-center rounded-[6px] transition-colors duration-[80ms]',
                  view === 'list' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]'
                )}
              >
                <span className="text-[14px]" aria-hidden>
                  ☰
                </span>
              </button>
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
                className={cn(
                  'flex size-8 items-center justify-center rounded-[6px] transition-colors duration-[80ms]',
                  view === 'grid' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]'
                )}
              >
                <span className="text-[14px]" aria-hidden>
                  ⊞
                </span>
              </button>
            </div>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              Add client
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => fetchClients()}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-0 border-b border-[var(--border-subtle)]" role="tablist" aria-label="Filter by status">
          {tabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'relative h-9 px-4 text-[14px] transition-colors duration-150',
                statusFilter === tab.value
                  ? 'font-medium text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--accent)]'
                  : 'font-normal text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              {tab.label}
              <span className="ml-1 text-[13px] text-[var(--text-quaternary)]">
                (
                {tab.value === ''
                  ? tabCounts.all
                  : tab.value === 'active'
                    ? tabCounts.active
                    : tab.value === 'paused'
                      ? tabCounts.paused
                      : tabCounts.completed}
                )
              </span>
            </button>
          ))}
        </div>

        {loading && <ClientListSkeleton view={view} />}
        {!loading && error && (
          <Card className="rounded-[var(--radius-lg)] border border-[var(--border-default)] p-8 text-center">
            <p className="text-[var(--text-primary)]">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => fetchClients()}>
              Try again
            </Button>
          </Card>
        )}
        {!loading && !error && clients.length === 0 && (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="mb-6 grid grid-cols-2 gap-2 opacity-30 sm:grid-cols-4" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-muted)]" />
              ))}
            </div>
            <div className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-muted)] text-[36px]">👥</div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">Add your first client</h2>
            <p className="mt-2 max-w-[360px] text-[14px] leading-relaxed text-[var(--text-tertiary)]">
              Invite clients to access their programs, schedule sessions, and message you through ClearPath.
            </p>
            <Button className="mt-6" onClick={() => setAddModalOpen(true)}>
              Add first client
            </Button>
          </div>
        )}
        {!loading && !error && clients.length > 0 && view === 'grid' && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {visibleClients.map((client) => {
              const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'
              const e = client.engagement
              const engLabel = e ? engagementLabelText(e.label) : '—'
              const engDot = e?.label === 'engaged' ? '🟢' : e?.label === 'moderate' ? '🟡' : '🔴'
              const sessionsN = client.sessionsCompletedCount ?? 0
              const showMenu = openMenuId === client.id
              return (
                <div
                  key={client.id}
                  className="card-interactive group relative flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)]"
                  onClick={() => router.push(`/coach/clients/${client.id}`)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      router.push(`/coach/clients/${client.id}`)
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <div className={cn('relative flex h-[120px] items-center justify-center', engagementThumbClass(e?.label))}>
                    <div className="relative flex size-16 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-bold text-white">
                      {getInitials(client.first_name, client.last_name, client.email)}
                      <span
                        className={cn('absolute bottom-0 right-0 size-3 rounded-full border-2 border-white', statusDotClass(client.status))}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-primary)]">{name}</p>
                      <div
                        className={cn(
                          'relative opacity-0 transition-opacity duration-150 group-hover:opacity-100',
                          showMenu && 'opacity-100'
                        )}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <details open={showMenu} onToggle={(ev) => setOpenMenuId((ev.target as HTMLDetailsElement).open ? client.id : null)}>
                          <summary className="flex size-6 cursor-pointer list-none items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]">
                            ···
                          </summary>
                          <div className="absolute right-2 top-10 z-30 min-w-[140px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] py-1 shadow-[var(--shadow-lg)]">
                            <Link
                              href={`/coach/messages?clientId=${encodeURIComponent(client.id)}`}
                              className="block px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Message
                            </Link>
                            <Link
                              href={`/coach/clients/${client.id}`}
                              className="block px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                              onClick={() => setOpenMenuId(null)}
                            >
                              View
                            </Link>
                            <Link
                              href={`/coach/clients/${client.id}`}
                              className="block px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--error)] hover:bg-[var(--bg-muted)]"
                              onClick={() => void deleteClient(client)}
                            >
                              Delete
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">{client.email || '—'}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {client.activeProgramTitle?.trim() ? (
                        <span className="max-w-full truncate rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[12px] font-medium text-[var(--accent)]">
                          📚 {client.activeProgramTitle}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[12px] text-[var(--text-tertiary)]">No program</span>
                      )}
                      <span className="text-[12px] text-[var(--text-tertiary)]">
                        {sessionsN} {sessionsN === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2">
                    <span className="text-[12px] text-[var(--text-tertiary)]">
                      <span aria-hidden>{engDot}</span> {engLabel}
                    </span>
                    <span className="text-[12px] text-[var(--text-quaternary)]">{lastActiveLabel(client)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!loading && !error && clients.length > 0 && view === 'list' && (
          <div className="[&_tbody_tr]:min-h-[52px] [&_tbody_tr]:h-[52px]">
            <DataTable
              rows={visibleClients}
              loading={loading}
              rowHref={(row) => `/coach/clients/${row.id}`}
              emptyTitle="No clients match"
              emptyDescription="Try another tab or search."
              columns={columns}
            />
          </div>
        )}
      </div>

      <AddClientModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={handleAddSuccess} />

      <QuickInvoiceModal
        open={quickInvoiceOpen}
        onClose={() => {
          setQuickInvoiceOpen(false)
          setQuickInvoiceClientId(null)
        }}
        defaultClientId={quickInvoiceClientId}
        onSent={(name) => {
          setToast(`Invoice sent to ${name}`)
          setTimeout(() => setToast(null), 4000)
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[var(--border-default)] bg-[var(--text-primary)] px-4 py-3 text-[15px] font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function ClientListSkeleton({ view }: { view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)]">
        <div className="h-12 animate-pulse bg-[var(--bg-muted)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[52px] animate-pulse border-t border-[var(--border-subtle)] bg-[var(--bg-app)]" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)]">
          <div className="h-[120px] animate-pulse bg-[var(--bg-muted)]" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
