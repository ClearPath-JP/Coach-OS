'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
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

function getInitials(first: string | null, last: string | null, email: string | null): string {
  if (first?.trim() || last?.trim()) {
    const a = (first?.trim() ?? '').slice(0, 1).toUpperCase()
    const b = (last?.trim() ?? '').slice(0, 1).toUpperCase()
    if (a || b) return `${a}${b}`
  }
  if (email?.trim()) return (email.trim().slice(0, 2)).toUpperCase()
  return '?'
}

function statusTone(status: string): 'active' | 'pending' | 'inactive' {
  if (status === 'active') return 'active'
  if (status === 'paused') return 'pending'
  return 'inactive'
}

export function CoachClientsPageContent() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false)
  const [quickInvoiceClientId, setQuickInvoiceClientId] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)
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
  }, [search, statusFilter])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  const handleAddSuccess = () => {
    setToast('Client added')
    fetchClients()
    setTimeout(() => setToast(null), 4000)
  }

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ]

  return (
    <>
      <PageHeader
        title="Clients"
        contextInfo={`${clients.filter((c) => c.status === 'active').length} active · ${clients.filter((c) => c.status === 'paused').length} paused`}
      >
        <Button size="sm" variant="secondary" onClick={() => fetchClients()}>
          Refresh
        </Button>
        <Button size="sm" className="w-full min-[480px]:w-auto" onClick={() => setAddModalOpen(true)}>
          Add client
        </Button>
      </PageHeader>

      <div className="mt-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search clients"
              className="w-full max-w-md"
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {tabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-[15px] font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <ClientListSkeleton />}
        {!loading && error && (
          <Card className="rounded-xl border border-[var(--color-border)] p-6 text-center">
            <p className="text-[var(--color-text-primary)]">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => fetchClients()}>
              Try again
            </Button>
          </Card>
        )}
        {!loading && !error && clients.length === 0 && (
          <Card className="p-12 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[36px]">👥</div>
            <h2 className="mt-4 text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Your first client is waiting
            </h2>
            <p className="mx-auto mt-3 max-w-[400px] text-[var(--text-14)] font-normal leading-[1.6] text-[var(--text-tertiary)]">
              Add a client and send them their login details. They&apos;ll be able to see their programs, book sessions,
              and message you directly.
            </p>
            <Button className="mt-8 min-h-11" onClick={() => setAddModalOpen(true)}>
              Add your first client
            </Button>
          </Card>
        )}
        {!loading && !error && clients.length > 0 && (
          <DataTable
            rows={clients}
            loading={loading}
            rowHref={(row) => `/coach/clients/${row.id}`}
            emptyTitle="Your first client is waiting"
            emptyDescription="Add a client and send them their login details. They will see programs, book sessions, and message you directly."
            columns={[
              {
                key: 'name',
                header: 'Name',
                sortValue: (r) => `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
                render: (client) => (
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-semibold text-[var(--accent)]">{getInitials(client.first_name, client.last_name, client.email)}</div>
                    <div className="min-w-0">
                      <p className="truncate">{[client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'}</p>
                      <p className="truncate text-[12px] text-[var(--text-tertiary)]">{client.email || '—'}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                sortValue: (r) => r.status,
                render: (client) => <span className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)]"><StatusDot tone={statusTone(client.status)} />{client.status}</span>,
              },
              {
                key: 'engagement',
                header: 'Engagement',
                sortValue: (r) => r.engagement?.score ?? 0,
                render: (client) => {
                  const e = client.engagement
                  if (!e) return <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
                  const dot =
                    e.label === 'engaged' ? '🟢' : e.label === 'moderate' ? '🟡' : '🔴'
                  const last = client.rewards?.last_activity_at
                  const done = client.rewards?.assignments_completed ?? 0
                  const total = client.rewards?.assignments_total ?? 0
                  const streak = client.rewards?.current_streak_days ?? 0
                  const activeLine = last
                    ? `Active ${formatDistanceToNow(new Date(last), { addSuffix: true })}`
                    : 'No recent activity logged'
                  const tip = `${activeLine} · ${done}/${total} assignments complete · ${streak}-day streak`
                  const label = engagementLabelText(e.label)
                  return (
                    <Tooltip content={tip}>
                      <span
                        className="inline-flex cursor-default items-center gap-1.5 text-[13px] font-medium"
                        style={{ color: e.color }}
                      >
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
                render: (client) => <span className="text-[13px] text-[var(--text-tertiary)]">{client.updated_at ? formatDistanceToNow(new Date(client.updated_at), { addSuffix: true }) : '—'}</span>,
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (client) => (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/coach/messages?clientId=${encodeURIComponent(client.id)}`}
                      className="text-[13px] font-medium text-[var(--color-accent)] hover:underline"
                    >
                      Message
                    </Link>
                    <details className="relative">
                      <summary className="cursor-pointer list-none text-[18px] leading-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        ···
                      </summary>
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
            ] as DataColumn<Client>[]}
          />
        )}
      </div>

      <AddClientModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

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
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-text-primary)] px-4 py-3 text-[15px] font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  )
}

function ClientListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card
          key={i}
          variant="flat"
          padding="lg"
          className="h-full border-[0.5px] border-[var(--color-border)] bg-[var(--color-background-primary)]"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--color-border)] animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-[var(--color-border)] animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
