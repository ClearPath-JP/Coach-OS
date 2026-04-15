'use client'

import { useState } from 'react'
import type { AdminOverviewPayload } from '@/lib/admin-overview-data'
import { mailtoPastDueBilling, mailtoInactiveCoachCheckIn } from '@/lib/admin-attention-mailto'

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function storageLabel(bytes: number): string {
  if (bytes === 0) return '0 MB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)} MB`
}

function storagePct(bytes: number, maxGb: number): number {
  if (maxGb <= 0) return 0
  return Math.min(100, Math.round((bytes / (maxGb * 1024 * 1024 * 1024)) * 100))
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-50 text-blue-700',
  pro: 'bg-purple-50 text-purple-700',
  scale: 'bg-amber-50 text-amber-700',
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Trial: 'bg-sky-50 text-sky-700',
  Paused: 'bg-red-50 text-red-700',
}

type CoachRow = AdminOverviewPayload['workspaces'][number]

export function AdminDashboardClient({ data }: { data: AdminOverviewPayload }) {
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirst, setInviteFirst] = useState('')
  const [inviteLast, setInviteLast] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const totalStorage = data.workspaces.reduce((s, w) => s + w.storageUsedBytes, 0)
  const totalClients = data.totals.clients

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteResult(null)
    try {
      const res = await fetch('/api/admin/coaches/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          firstName: inviteFirst.trim() || undefined,
          lastName: inviteLast.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setInviteResult('Coach invited! They will receive an email.')
        setInviteEmail('')
        setInviteFirst('')
        setInviteLast('')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setInviteResult(json.error ?? 'Failed to invite')
      }
    } catch {
      setInviteResult('Network error')
    } finally {
      setInviting(false)
    }
  }

  const handleExtendTrial = async (workspaceId: string) => {
    setActionLoading(workspaceId)
    try {
      await fetch(`/api/admin/coaches/${workspaceId}/extend-trial`, { method: 'POST' })
      window.location.reload()
    } finally {
      setActionLoading(null)
      setActionMenu(null)
    }
  }

  const handleChangePlan = async (workspaceId: string, plan: string) => {
    setActionLoading(workspaceId)
    try {
      await fetch(`/api/admin/coaches/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      window.location.reload()
    } finally {
      setActionLoading(null)
      setActionMenu(null)
    }
  }

  const handleSuspend = async (workspaceId: string) => {
    if (!confirm('Suspend this workspace? The coach will lose access.')) return
    setActionLoading(workspaceId)
    try {
      await fetch(`/api/admin/coaches/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceStatus: 'suspended' }),
      })
      window.location.reload()
    } finally {
      setActionLoading(null)
      setActionMenu(null)
    }
  }

  const handleMagicLink = async (workspaceId: string) => {
    setActionLoading(workspaceId)
    try {
      const res = await fetch(`/api/admin/coaches/${workspaceId}/coach-magic-link`, { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.actionLink) {
        await navigator.clipboard.writeText(json.actionLink)
        alert('Magic link copied to clipboard! Opens their account.')
      } else {
        alert(json.error ?? 'Failed to generate link')
      }
    } finally {
      setActionLoading(null)
      setActionMenu(null)
    }
  }

  const clients = data.clientsByWorkspace

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-[var(--text-primary)]">Dashboard</h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Your business at a glance
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          + Invite Coach
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Coaches" value={String(data.totals.coaches)} sub={`${data.totals.newWorkspacesThisMonth} new this month`} color="blue" />
        <StatCard label="Total Clients" value={String(totalClients)} sub={`${data.totals.activeClientsThisWeek} active this week`} color="emerald" />
        <StatCard label="MRR" value={money(data.totals.monthlyRevenueCents)} sub={`${data.totals.paymentsThisMonthCount} payments`} color="violet" />
        <StatCard label="Storage Used" value={storageLabel(totalStorage)} sub={`across ${data.workspaces.length} workspaces`} color="amber" />
      </div>

      {/* Attention */}
      {data.attentionItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <h2 className="text-[14px] font-semibold text-amber-900">Needs Your Attention</h2>
          <div className="mt-3 space-y-2">
            {data.attentionItems.map((item, i) => (
              <AttentionRow key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* System Health */}
      <div className="flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-white p-4">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">System</span>
        <HealthDot label="Database" status={data.health.database} />
        <HealthDot label="Auth" status={data.health.auth} />
        <HealthDot label="Storage" status={data.health.storage} />
        <HealthDot label="Redis" status={data.health.redis} />
      </div>

      {/* Coaches Table */}
      <div className="rounded-xl border border-[var(--border-default)] bg-white">
        <div className="border-b border-[var(--border-default)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Coaches</h2>
        </div>
        {data.workspaces.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] text-[var(--text-muted)]">No coaches yet. Invite your first one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.workspaces.map((coach) => (
              <CoachRow
                key={coach.workspaceId}
                coach={coach}
                clients={clients[coach.workspaceId] ?? []}
                expanded={expandedCoach === coach.workspaceId}
                onToggle={() => setExpandedCoach(expandedCoach === coach.workspaceId ? null : coach.workspaceId)}
                menuOpen={actionMenu === coach.workspaceId}
                onMenuToggle={() => setActionMenu(actionMenu === coach.workspaceId ? null : coach.workspaceId)}
                loading={actionLoading === coach.workspaceId}
                onExtendTrial={() => handleExtendTrial(coach.workspaceId)}
                onChangePlan={(plan) => handleChangePlan(coach.workspaceId, plan)}
                onSuspend={() => handleSuspend(coach.workspaceId)}
                onMagicLink={() => handleMagicLink(coach.workspaceId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">Invite a Coach</h3>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              They will get an email to set up their account.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="email"
                placeholder="Email address *"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={inviteFirst}
                  onChange={(e) => setInviteFirst(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={inviteLast}
                  onChange={(e) => setInviteLast(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
              {inviteResult && (
                <p className={`text-[13px] ${inviteResult.includes('invited') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {inviteResult}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleInvite()}
                  disabled={inviting || !inviteEmail.trim()}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const borderColor: Record<string, string> = {
    blue: 'border-l-blue-500',
    emerald: 'border-l-emerald-500',
    violet: 'border-l-violet-500',
    amber: 'border-l-amber-500',
  }
  return (
    <div className={`rounded-xl border border-[var(--border-default)] border-l-4 ${borderColor[color] ?? ''} bg-white p-4`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{sub}</p>
    </div>
  )
}

function HealthDot({ label, status }: { label: string; status: 'ok' | 'error' }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
    </div>
  )
}

function AttentionRow({ item }: { item: AdminOverviewPayload['attentionItems'][number] }) {
  if (item.type === 'past_due') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
        <p className="text-[13px] text-amber-900">
          <strong>{item.workspaceName}</strong> — subscription past due
        </p>
        {item.coachEmail && (
          <a
            href={mailtoPastDueBilling({ coachEmail: item.coachEmail, workspaceName: item.workspaceName })}
            className="shrink-0 rounded-md border border-amber-300 px-2.5 py-1 text-[12px] font-medium text-amber-800 hover:bg-amber-100"
          >
            Email Coach
          </a>
        )}
      </div>
    )
  }
  if (item.type === 'inactive_coach') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
        <p className="text-[13px] text-amber-900">
          <strong>{item.workspaceName}</strong> — inactive {item.daysInactive} days
        </p>
        {item.coachEmail && (
          <a
            href={mailtoInactiveCoachCheckIn({ coachEmail: item.coachEmail, workspaceName: item.workspaceName, daysInactive: item.daysInactive })}
            className="shrink-0 rounded-md border border-amber-300 px-2.5 py-1 text-[12px] font-medium text-amber-800 hover:bg-amber-100"
          >
            Check In
          </a>
        )}
      </div>
    )
  }
  if (item.type === 'failed_logins') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white px-3 py-2">
        <p className="text-[13px] text-red-900">
          {item.count} failed logins from <strong>{item.label}</strong>
        </p>
      </div>
    )
  }
  return null
}

function CoachRow({
  coach,
  clients,
  expanded,
  onToggle,
  menuOpen,
  onMenuToggle,
  loading,
  onExtendTrial,
  onChangePlan,
  onSuspend,
  onMagicLink,
}: {
  coach: CoachRow
  clients: AdminOverviewPayload['clientsByWorkspace'][string]
  expanded: boolean
  onToggle: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  loading: boolean
  onExtendTrial: () => void
  onChangePlan: (plan: string) => void
  onSuspend: () => void
  onMagicLink: () => void
}) {
  const pct = storagePct(coach.storageUsedBytes, coach.maxVideoStorageGb)
  const storageBarColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="relative">
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg-subtle)]/50">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Show clients"
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Coach info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-medium text-[var(--text-primary)]">{coach.workspaceName}</p>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PLAN_COLORS[coach.plan] ?? PLAN_COLORS.free}`}>
              {coach.plan}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[coach.statusLabel] ?? STATUS_COLORS.Active}`}>
              {coach.statusLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{coach.coachEmail}</p>
        </div>

        {/* Stats */}
        <div className="hidden items-center gap-6 sm:flex">
          <div className="text-center">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">{coach.clientsCount}</p>
            <p className="text-[10px] text-[var(--text-muted)]">clients</p>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
              {money(coach.revenueThisMonthCents)}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">this month</p>
          </div>
          <div className="w-24">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>Storage</span>
              <span>{storageLabel(coach.storageUsedBytes)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${storageBarColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[12px] text-[var(--text-muted)]">{timeAgo(coach.lastActive)}</p>
            <p className="text-[10px] text-[var(--text-muted)]">last active</p>
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            type="button"
            onClick={onMenuToggle}
            disabled={loading}
            className="rounded-md px-2 py-1 text-[16px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            {loading ? '...' : '...'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-[var(--border-default)] bg-white py-1 shadow-lg">
              <MenuButton onClick={onMagicLink}>Sign in as coach</MenuButton>
              <MenuButton onClick={onExtendTrial}>Extend trial +14 days</MenuButton>
              <div className="my-1 border-t border-[var(--border-default)]" />
              <MenuButton onClick={() => onChangePlan('free')}>Set to Free</MenuButton>
              <MenuButton onClick={() => onChangePlan('starter')}>Set to Starter</MenuButton>
              <MenuButton onClick={() => onChangePlan('pro')}>Set to Pro</MenuButton>
              <MenuButton onClick={() => onChangePlan('scale')}>Set to Scale</MenuButton>
              <div className="my-1 border-t border-[var(--border-default)]" />
              <MenuButton onClick={() => window.open(`mailto:${coach.coachEmail}`)}>Email coach</MenuButton>
              <MenuButton onClick={onSuspend} danger>Suspend workspace</MenuButton>
            </div>
          )}
        </div>
      </div>

      {/* Expanded: client list */}
      {expanded && (
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)]/40 px-5 py-3">
          {clients.length === 0 ? (
            <p className="py-2 text-[13px] text-[var(--text-muted)]">No clients yet</p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-4 px-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                <span className="flex-1">Client</span>
                <span className="w-20 text-center">Sessions</span>
                <span className="w-24">Program</span>
                <span className="w-16 text-center">Status</span>
                <span className="w-20 text-right">Joined</span>
              </div>
              {clients.map((client) => (
                <div key={client.id} className="flex items-center gap-4 rounded-md px-2 py-1.5 hover:bg-white">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-[var(--text-primary)]">{client.displayName}</p>
                    {client.email && (
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{client.email}</p>
                    )}
                  </div>
                  <span className="w-20 text-center text-[13px] text-[var(--text-secondary)]">
                    {client.sessionsCount}
                  </span>
                  <span className="w-24 truncate text-[12px] text-[var(--text-muted)]">
                    {client.programName ?? '—'}
                  </span>
                  <span className="w-16 text-center">
                    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      client.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {client.status}
                    </span>
                  </span>
                  <span className="w-20 text-right text-[12px] text-[var(--text-muted)]">
                    {new Date(client.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--bg-subtle)] ${
        danger ? 'text-red-600' : 'text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  )
}
