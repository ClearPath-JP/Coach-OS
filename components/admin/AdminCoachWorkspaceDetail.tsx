'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatAuditDescription, type AuditDisplayContext } from '@/lib/admin-audit-messages'

type DetailPayload = {
  workspace: { id: string; name: string; status: string; created_at: string }
  adminNotes: string
  coach: {
    full_name: string | null
    email: string | null
    created_at: string | null
    updated_at: string | null
    logo_url: string | null
  } | null
  coachJoinedAt: string | null
  lastLoginAt: string | null
  subscription: {
    plan: string
    status: string
    current_period_end: string | null
    stripe_customer_id: string | null
    trial_ends_at: string | null
  } | null
  clients: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    status: string
    created_at: string
    updated_at: string
    sessions: number
    programs: number
    programName: string | null
  }>
  usage: {
    messages: number
    sessions: number
    sessionsThisMonth: number
    programs: number
    videos: number
    clients: number
    clientLimit: number
    storageUsedBytes: number
    storageLimitGb: number
  }
  recentAudit: Array<{
    action: string
    user_id: string | null
    actorName: string | null
    actorEmail: string | null
    ip_address: string | null
    created_at: string
    metadata: unknown
  }>
}

function bytesToGb(n: number): string {
  return (n / (1024 * 1024 * 1024)).toFixed(1)
}

function Progress({ value, danger }: { value: number; danger?: boolean }) {
  const pct = Math.min(100, Math.round(value * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full ${danger ? 'bg-red-500' : 'bg-blue-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]!
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]!
  return (first[0]! + last[0]!).toUpperCase()
}

function clientStatusDot(status: string): string {
  if (status === 'paused') return 'bg-amber-500'
  if (status === 'completed' || status === 'inactive') return 'bg-slate-400'
  return 'bg-emerald-500'
}

export function AdminCoachWorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [data, setData] = useState<DetailPayload | null>(null)
  const [plan, setPlan] = useState('free')
  const [notes, setNotes] = useState('')
  const notesDirtyRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [suspendName, setSuspendName] = useState('')
  const [deleteStep, setDeleteStep] = useState(0)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [headerPlanOpen, setHeaderPlanOpen] = useState(false)
  const [magicLinkBusy, setMagicLinkBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)

  const load = useCallback(() => {
    void fetch(`/api/admin/coaches/${workspaceId}`)
      .then((r) => r.json())
      .then((json) => {
        const d = json.data as DetailPayload | undefined
        setData(d ?? null)
        setPlan(d?.subscription?.plan ?? 'free')
        if (d && !notesDirtyRef.current) setNotes(d.adminNotes ?? '')
      })
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const saveNotes = async (value: string) => {
    setSaving(true)
    await fetch(`/api/admin/coaches/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: value }),
    })
    setSaving(false)
    notesDirtyRef.current = false
    setBanner('Notes saved')
    load()
  }

  const savePlan = async () => {
    if (!window.confirm(`Update subscription plan to “${plan}”?`)) return
    setSaving(true)
    setBanner(null)
    await fetch(`/api/admin/coaches/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    setSaving(false)
    setBanner('Plan updated')
    load()
  }

  const extendTrial = async () => {
    setSaving(true)
    const res = await fetch(`/api/admin/coaches/${workspaceId}/extend-trial`, { method: 'POST' })
    setSaving(false)
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.data?.trialEndsAt) {
      setBanner(`Trial extended to ${new Date(json.data.trialEndsAt).toLocaleString()}`)
      load()
    } else {
      setBanner('Could not extend trial')
    }
  }

  const suspend = async () => {
    if (!data || suspendName !== data.workspace.name) return
    setSaving(true)
    await fetch(`/api/admin/coaches/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceStatus: 'suspended' }),
    })
    setSaving(false)
    setSuspendName('')
    setBanner('Workspace suspended')
    load()
  }

  const resetFree = async () => {
    setSaving(true)
    await fetch(`/api/admin/coaches/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToFree: true }),
    })
    setSaving(false)
    setShowResetConfirm(false)
    setBanner('Reset to free plan')
    load()
  }

  const openCoachMagicLink = async () => {
    if (
      !window.confirm(
        'Generate a one-time sign-in link for this coach? Open it in a private or incognito window so your admin session stays signed in here.'
      )
    ) {
      return
    }
    setMagicLinkBusy(true)
    setBanner(null)
    try {
      const res = await fetch(`/api/admin/coaches/${workspaceId}/coach-magic-link`, { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { actionLink?: string; expiresNote?: string }
        error?: string
      }
      if (!res.ok || !json.data?.actionLink) {
        setBanner(json.error ?? 'Could not create coach access link')
        return
      }
      window.open(json.data.actionLink, '_blank', 'noopener,noreferrer')
      setBanner(json.data.expiresNote ?? 'Link opened in a new tab.')
    } finally {
      setMagicLinkBusy(false)
    }
  }

  const exportWorkspaceCsv = async () => {
    setExportBusy(true)
    setBanner(null)
    try {
      const res = await fetch(`/api/admin/coaches/${workspaceId}/export`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setBanner(j.error ?? 'Export failed')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      let filename = `workspace-${workspaceId.slice(0, 8)}-export.csv`
      const m = cd?.match(/filename="([^"]+)"/)
      if (m?.[1]) filename = m[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setBanner('Export downloaded.')
    } finally {
      setExportBusy(false)
    }
  }

  const deleteWorkspace = async () => {
    if (!data || deletePhrase !== `DELETE ${data.workspace.name}`) return
    setSaving(true)
    const res = await fetch(`/api/admin/coaches/${workspaceId}`, { method: 'DELETE' })
    setSaving(false)
    if (res.ok) {
      router.push('/admin/coaches')
      router.refresh()
    } else {
      setBanner('Could not delete workspace')
    }
  }

  const copyStripe = (id: string) => {
    void navigator.clipboard.writeText(id)
    setBanner('Stripe customer ID copied')
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Loading workspace…</p>
  }

  const w = data.workspace
  const coachEmail = data.coach?.email ?? '—'
  const coachDisplay = data.coach?.full_name ?? 'Coach'
  const clientPct = data.usage.clientLimit > 0 ? data.usage.clients / data.usage.clientLimit : 0
  const storageGbUsed = data.usage.storageUsedBytes / (1024 * 1024 * 1024)
  const storagePct = data.usage.storageLimitGb > 0 ? storageGbUsed / data.usage.storageLimitGb : 0
  const stripeId = data.subscription?.stripe_customer_id
  const subStatus = data.subscription?.status ?? 'active'
  const isSuspended = w.status === 'suspended'

  return (
    <div className="space-y-8">
      {banner ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-2 text-sm text-[var(--text-secondary)]">{banner}</div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[28px] font-medium leading-tight text-slate-900">{w.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {coachDisplay} · {coachEmail}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isSuspended ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Suspended
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-[var(--text-primary)]">
              {subStatus.replace('_', ' ')}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
              {data.subscription?.plan ?? 'free'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" type="button" onClick={extendTrial} disabled={saving}>
            Extend trial
          </Button>
          <div className="relative">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setHeaderPlanOpen((o) => !o)}
            >
              Change plan ▾
            </Button>
            {headerPlanOpen ? (
              <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-2 shadow-lg">
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border-default)] px-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="founding">Founding ($99/mo)</option>
                  <option value="starter">Starter ($79/mo)</option>
                  <option value="pro">Pro ($149/mo)</option>
                  <option value="scale">Scale ($299/mo)</option>
                </select>
                <Button className="mt-2 w-full" size="sm" type="button" onClick={() => { setHeaderPlanOpen(false); void savePlan() }} disabled={saving}>
                  Update plan
                </Button>
              </div>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="destructive-secondary"
            type="button"
            disabled={saving || isSuspended}
            onClick={() => {
              const el = document.getElementById('suspend-workspace')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Suspend
          </Button>
          <Button
            size="sm"
            variant="danger"
            type="button"
            onClick={() => {
              const el = document.getElementById('delete-workspace')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Delete…
          </Button>
        </div>
      </div>

      {showResetConfirm ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Reset this workspace to the free plan?</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive-secondary" onClick={resetFree} disabled={saving}>
              Confirm reset
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Subscription</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium capitalize text-blue-800">
                {data.subscription?.plan ?? 'free'}
              </span>
              <span className="text-xs text-[var(--text-tertiary)] capitalize">{subStatus.replace('_', ' ')}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Period ends:{' '}
              {data.subscription?.current_period_end
                ? new Date(data.subscription.current_period_end).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-[var(--text-primary)]">
                {stripeId ?? '—'}
              </code>
              {stripeId ? (
                <Button size="xs" variant="secondary" type="button" onClick={() => copyStripe(stripeId)}>
                  Copy
                </Button>
              ) : null}
            </div>
            {stripeId ? (
              <a
                href={`https://dashboard.stripe.com/customers/${stripeId}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
              >
                View in Stripe →
              </a>
            ) : null}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500">Change plan</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border-default)] px-3 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="founding">Founding ($99/mo)</option>
                  <option value="starter">Starter ($79/mo)</option>
                  <option value="pro">Pro ($149/mo)</option>
                  <option value="scale">Scale ($299/mo)</option>
                </select>
                <Button size="sm" onClick={() => void savePlan()} disabled={saving}>
                  {saving ? 'Saving…' : 'Update plan'}
                </Button>
                <Button size="sm" variant="secondary" type="button" onClick={() => setShowResetConfirm(true)}>
                  Reset to free
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Usage</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Clients</p>
                <p className="text-sm font-medium text-slate-900">
                  {data.usage.clients} / {data.usage.clientLimit}
                </p>
                <Progress value={clientPct} danger={clientPct > 0.8} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Storage</p>
                <p className="text-sm font-medium text-slate-900">
                  {bytesToGb(data.usage.storageUsedBytes)} / {data.usage.storageLimitGb} GB
                </p>
                <Progress value={storagePct} danger={storagePct > 0.8} />
              </div>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-[var(--text-tertiary)]">
              <li>Sessions this month: {data.usage.sessionsThisMonth}</li>
              <li>Messages sent: {data.usage.messages}</li>
              <li>Programs created: {data.usage.programs}</li>
              <li>Videos uploaded: {data.usage.videos}</li>
            </ul>
          </div>

          <div id="clients">
            <h2 className="mb-2 text-sm font-medium text-slate-900">Clients</h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Sessions</th>
                    <th className="px-4 py-2">Program</th>
                    <th className="px-4 py-2">Joined</th>
                    <th className="px-4 py-2">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No clients in this workspace yet.
                      </td>
                    </tr>
                  ) : (
                    data.clients.map((c) => {
                      const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client'
                      return (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="px-4 py-2 font-medium text-slate-900">
                            <span
                              className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${clientStatusDot(c.status)}`}
                              aria-hidden
                            />
                            {name}
                          </td>
                          <td className="px-4 py-2 text-[var(--text-tertiary)]">{c.email ?? '—'}</td>
                          <td className="px-4 py-2 capitalize text-[var(--text-secondary)]">{c.status}</td>
                          <td className="px-4 py-2">{c.sessions}</td>
                          <td className="px-4 py-2 text-[var(--text-tertiary)]">{c.programName ?? 'None'}</td>
                          <td className="px-4 py-2 text-[var(--text-tertiary)]">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-[var(--text-tertiary)]">
                            {c.updated_at
                              ? formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })
                              : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Coach</h2>
            <div className="mt-3 flex gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-[var(--text-secondary)]"
                aria-hidden
              >
                {initials(coachDisplay)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{coachDisplay}</p>
                <p className="text-xs text-slate-500">{coachEmail}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Joined:{' '}
                  {data.coachJoinedAt
                    ? new Date(data.coachJoinedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
                <p className="text-xs text-slate-500">
                  Last login:{' '}
                  {data.lastLoginAt
                    ? formatDistanceToNow(new Date(data.lastLoginAt), { addSuffix: true })
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Recent activity</h2>
            <p className="text-xs text-slate-500">Last 15 events for this workspace</p>
            <ul className="mt-3 space-y-3 text-sm">
              {data.recentAudit.map((a, idx) => {
                const meta = (a.metadata as Record<string, unknown>) ?? {}
                const ctx: AuditDisplayContext = {
                  actorName: a.actorName,
                  actorEmail: a.actorEmail,
                  workspaceName: w.name,
                  targetEmail: typeof meta.email === 'string' ? meta.email : null,
                  ip: a.ip_address,
                  coachLabel: w.name,
                }
                const { segments } = formatAuditDescription(a.action, meta, ctx)
                return (
                  <li key={`${a.action}-${a.created_at}-${idx}`} className="border-b border-slate-100 pb-3 last:border-0">
                    <p className="leading-snug text-[var(--text-primary)]">
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
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </li>
                )
              })}
            </ul>
            <Link href="/admin/audit" className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
              Full audit log →
            </Link>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Admin notes</h2>
            <p className="mt-1 text-xs text-slate-500">Internal only — coaches never see this.</p>
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-lg border border-[var(--border-default)] p-3 text-sm"
              value={notes}
              onChange={(e) => {
                notesDirtyRef.current = true
                setNotes(e.target.value)
              }}
              onBlur={() => {
                if (notesDirtyRef.current) void saveNotes(notes)
              }}
              placeholder="Notes about this coach…"
            />
            {saving ? <p className="mt-1 text-xs text-slate-500">Saving…</p> : null}
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 shadow-sm">
            <h2 className="text-sm font-medium text-slate-900">Quick actions</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <span className="text-slate-500">Send test assignment</span>{' '}
                <span className="text-xs text-slate-400">(coming soon)</span>
              </li>
              <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[var(--text-secondary)]">View their dashboard</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={magicLinkBusy || saving}
                  onClick={() => void openCoachMagicLink()}
                >
                  {magicLinkBusy ? 'Creating link…' : 'Open magic link'}
                </Button>
              </li>
              <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[var(--text-secondary)]">Export their data (CSV)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={exportBusy || saving}
                  onClick={() => void exportWorkspaceCsv()}
                >
                  {exportBusy ? 'Preparing…' : 'Download CSV'}
                </Button>
              </li>
            </ul>
          </div>

          <div id="suspend-workspace" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <h2 className="text-sm font-medium text-amber-950">Suspend workspace</h2>
            <p className="mt-1 text-xs text-amber-900">Blocks coach access until reactivated.</p>
            <input
              className="mt-2 h-9 w-full rounded-lg border border-[var(--border-default)] px-3 text-sm"
              placeholder={`Type workspace name: ${w.name}`}
              value={suspendName}
              onChange={(e) => setSuspendName(e.target.value)}
            />
            <Button className="mt-2" variant="destructive-secondary" size="sm" onClick={() => void suspend()} disabled={saving}>
              Suspend workspace
            </Button>
          </div>

          <div id="delete-workspace" className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <h2 className="text-sm font-medium text-red-900">Delete workspace</h2>
            <p className="mt-1 text-xs text-red-800">Permanent. Type DELETE {w.name}</p>
            {deleteStep === 0 ? (
              <Button className="mt-2" variant="danger" size="sm" onClick={() => setDeleteStep(1)}>
                Delete workspace…
              </Button>
            ) : (
              <div className="mt-2 space-y-2">
                <input
                  className="h-9 w-full rounded-lg border border-[var(--border-default)] px-3 text-sm"
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                />
                <Button variant="danger" size="sm" onClick={() => void deleteWorkspace()} disabled={saving}>
                  Delete permanently
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDeleteStep(0)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm">
        <Link href="/admin/coaches" className="text-blue-600 hover:underline">
          ← All coaches
        </Link>
      </p>
    </div>
  )
}
