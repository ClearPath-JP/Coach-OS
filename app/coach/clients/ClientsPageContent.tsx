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
import { AddClientModal } from './AddClientModal'
import { formatDistanceToNow } from 'date-fns'

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
  rewards?: { total_xp: number; level: number } | null
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
            <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Add your first client</h2>
            <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-[1.6] text-[var(--text-tertiary)]">Invite clients to access their programs, schedule sessions, and stay connected through ClearPath.</p>
            <Button className="mt-6" onClick={() => setAddModalOpen(true)}>Add client</Button>
          </Card>
        )}
        {!loading && !error && clients.length > 0 && (
          <DataTable
            rows={clients}
            loading={loading}
            rowHref={(row) => `/coach/clients/${row.id}`}
            emptyTitle="Add your first client"
            emptyDescription="Invite clients to access their programs, schedule sessions, and stay connected through ClearPath."
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
              { key: 'sessions', header: 'Sessions', render: () => <span className="text-[var(--text-tertiary)]">—</span> },
              { key: 'program', header: 'Program', render: () => <span className="text-[var(--text-tertiary)]">General</span> },
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
                  <Link
                    href={`/coach/messages?clientId=${encodeURIComponent(client.id)}`}
                    className="text-[13px] font-medium text-[var(--color-accent)] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Message
                  </Link>
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
