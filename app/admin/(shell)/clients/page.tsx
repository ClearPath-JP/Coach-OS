'use client'

import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ClientRow = {
  workspaceId: string
  workspaceName: string
  coachEmail: string
  clientName: string
  email: string | null
  status: string
  plan: string
  joined: string
}

export default function AdminClientsPage() {
  const [rows, setRows] = useState<ClientRow[] | null>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())

    void fetch(`/api/admin/clients?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setRows(json.data ?? []))
      .catch(() => setLoadingError('Could not load clients — try again'))
  }, [search])

  const loading = rows == null && !loadingError
  const safeRows = useMemo(() => rows ?? [], [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">All clients</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Everyone invited as a client across all coaches — for support and search. Coaches manage their own clients
            from their dashboard.
          </p>
        </div>
        <div className="w-full max-w-md shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by workspace, coach email, or client email/name"
          />
        </div>
      </div>

      {loadingError ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-4 text-[14px] text-[var(--text-tertiary)]">
          {loadingError}
        </div>
      ) : null}

      <DataTable
        rows={safeRows}
        loading={loading}
        emptyTitle="No clients found"
        emptyDescription="Try adjusting your search."
        columns={[
          {
            key: 'workspace',
            header: 'Workspace',
            sortValue: (r) => r.workspaceName,
            render: (r) => r.workspaceName,
          },
          { key: 'client', header: 'Client', render: (r) => r.clientName, sortValue: (r) => r.clientName },
          { key: 'email', header: 'Email', render: (r) => r.email ?? '—', sortValue: (r) => r.email ?? '' },
          { key: 'plan', header: 'Plan', render: (r) => r.plan, sortValue: (r) => r.plan },
          { key: 'status', header: 'Status', render: (r) => r.status, sortValue: (r) => r.status },
          {
            key: 'joined',
            header: 'Joined',
            render: (r) => new Date(r.joined).toLocaleDateString(),
            sortValue: (r) => new Date(r.joined).getTime(),
          },
          {
            key: 'view',
            header: 'View',
            render: (r) => (
              <Button size="xs" onClick={() => (window.location.href = `/admin/coaches/${r.workspaceId}`)}>
                View
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}
