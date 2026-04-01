'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

type LiveHealthSummary = {
  checkedAt: string
  platformHealthOk: boolean
  failing: string[]
  slow: string[]
}

type HealthEntry = {
  ok: boolean
  ms: number
  slow: boolean
  status: 'healthy' | 'error' | 'slow'
  message: string | null
}

type SystemData = {
  checkedAt: string
  health: Record<string, HealthEntry>
  integrations: { googleOAuth: boolean; n8nPipeline: boolean }
  stats: {
    rows: Record<string, number>
    totalPlatformBytes: number
    videoStorageBytes: number
    assignmentStorageBytes: number
    fileStorageBytes: number
    videoFileCount: number
    nextVersion: string
    nodeVersion: string
  }
  auditLogs: Array<{ action: string; user_id: string | null; ip_address: string | null; created_at: string }>
}

const SERVICE_LABELS: Record<string, string> = {
  database: 'Database',
  auth: 'Authentication',
  storage: 'File storage',
  redis: 'Rate limiting (Redis)',
  stripe: 'Stripe',
  resend: 'Email (Resend)',
}

function bytes(value: number) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = value
  while (v > 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(1)} ${units[i]}`
}

function StatusIcon({ entry }: { entry: HealthEntry }) {
  if (!entry.ok) return <span className="text-xl text-red-600">✕</span>
  if (entry.slow) return <span className="text-xl text-amber-500">⏳</span>
  return <span className="text-xl text-emerald-600">✓</span>
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [liveSummary, setLiveSummary] = useState<LiveHealthSummary | null>(null)
  const [sending, setSending] = useState(false)
  const [cacheBusy, setCacheBusy] = useState(false)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [checksBusy, setChecksBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/system')
    const json = await r.json()
    setData(json.data ?? null)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch health snapshot on mount / refresh
    void load()
  }, [load])

  const pollLiveSummary = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/system?summary=1')
      const json = await r.json()
      const d = json.data as LiveHealthSummary | undefined
      if (d?.checkedAt) setLiveSummary(d)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- poll lightweight health summary on mount + interval
    void pollLiveSummary()
    const id = window.setInterval(() => void pollLiveSummary(), 45_000)
    return () => window.clearInterval(id)
  }, [pollLiveSummary])

  const sendTest = async () => {
    if (!window.confirm('Send a test email to your ADMIN_EMAIL inbox?')) return
    setSending(true)
    setMsg('')
    const res = await fetch('/api/admin/test-email', { method: 'POST' })
    setSending(false)
    setMsg(res.ok ? 'Test email sent — check your inbox.' : 'Could not send test email.')
  }

  const clearCache = async () => {
    if (
      !window.confirm(
        'Clear cached API responses? Coaches may see fresh data after slow loads on next request.'
      )
    ) {
      return
    }
    setCacheBusy(true)
    setMsg('')
    const res = await fetch('/api/admin/clear-cache', { method: 'POST' })
    setCacheBusy(false)
    setMsg(res.ok ? 'Application cache cleared.' : 'Could not clear cache.')
  }

  const refreshSettings = async () => {
    if (!window.confirm('Force-refresh workspace settings from the database?')) return
    setRefreshBusy(true)
    setMsg('')
    const res = await fetch('/api/admin/refresh-settings', { method: 'POST' })
    setRefreshBusy(false)
    setMsg(res.ok ? 'Settings refresh completed.' : 'Settings refresh failed.')
  }

  const runChecks = async () => {
    setMsg('')
    setChecksBusy(true)
    await load()
    setChecksBusy(false)
  }

  if (!data) return <p className="text-sm text-slate-500">Loading system…</p>

  const rowEntries = Object.entries(data.stats.rows)
  const maxRow = Math.max(1, ...rowEntries.map(([, v]) => v))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-slate-900">System health</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live checks for core services. Last checked: {new Date(data.checkedAt).toLocaleString()}
        </p>
        {liveSummary ? (
          <p
            className={`mt-2 text-xs ${
              liveSummary.platformHealthOk ? 'text-emerald-700' : 'text-amber-800'
            }`}
          >
            Auto-refresh (every 45s):{' '}
            {liveSummary.platformHealthOk
              ? `All checks OK · updated ${new Date(liveSummary.checkedAt).toLocaleTimeString()}`
              : `Issues: ${liveSummary.failing.map((k) => SERVICE_LABELS[k] ?? k).join(', ') || 'unknown'}`}
            {liveSummary.slow.length > 0
              ? ` · Slow: ${liveSummary.slow.map((k) => SERVICE_LABELS[k] ?? k).join(', ')}`
              : ''}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(data.health).map(([key, h]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <StatusIcon entry={h} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{SERVICE_LABELS[key] ?? key}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {h.status === 'healthy' && 'Healthy'}
                  {h.status === 'slow' && 'Slow response'}
                  {h.status === 'error' && 'Error'}
                </p>
                <p className="text-xs text-slate-500">{h.ms}ms</p>
                {h.message ? <p className="mt-2 text-xs leading-relaxed text-slate-700">{h.message}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-900">Integrations</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li className="flex justify-between gap-2">
            <span>Google OAuth (Drive)</span>
            <span className={data.integrations.googleOAuth ? 'text-emerald-600' : 'text-amber-700'}>
              {data.integrations.googleOAuth ? 'Configured' : 'Not configured'}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>n8n pipeline</span>
            <span className={data.integrations.n8nPipeline ? 'text-emerald-600' : 'text-amber-700'}>
              {data.integrations.n8nPipeline ? 'Configured' : 'Not configured'}
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          See <code className="rounded bg-slate-100 px-1">_docs/GOOGLE-DRIVE-SETUP.md</code> in the repository for the
          production checklist.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-900">Storage across the platform</h2>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{bytes(data.stats.totalPlatformBytes)}</p>
        <p className="text-xs text-slate-500">Videos + assignment files (approximate from file metadata)</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li className="flex justify-between">
            <span>Videos</span>
            <span>{bytes(data.stats.videoStorageBytes)}</span>
          </li>
          <li className="flex justify-between">
            <span>Assignments</span>
            <span>{bytes(data.stats.assignmentStorageBytes)}</span>
          </li>
          <li className="flex justify-between">
            <span>Other files</span>
            <span>{bytes(data.stats.fileStorageBytes)}</span>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-900">Database row counts</h2>
        <ul className="mt-4 space-y-3">
          {rowEntries.map(([k, v]) => (
            <li key={k}>
              <div className="flex justify-between text-xs text-slate-600">
                <span className="capitalize">{k}</span>
                <span className="font-medium text-slate-900">{v.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${Math.min(100, (v / maxRow) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Next.js {data.stats.nextVersion} · Node {data.stats.nodeVersion} · Video rows:{' '}
          {data.stats.videoFileCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-900">Manual controls</h2>
        <ul className="mt-4 space-y-4">
          <li className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-medium text-slate-900">Send test email to myself</p>
            <p className="mt-1 text-xs text-slate-600">
              Sends a test message to the address in ADMIN_EMAIL to confirm Resend delivery.
            </p>
            <Button className="mt-2" size="sm" onClick={sendTest} disabled={sending}>
              {sending ? 'Sending…' : 'Run test'}
            </Button>
          </li>
          <li className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-medium text-slate-900">Clear application cache</p>
            <p className="mt-1 text-xs text-slate-600">
              Clears cached API responses if coaches see stale data after you change configuration.
            </p>
            <Button className="mt-2" size="sm" variant="secondary" onClick={clearCache} disabled={cacheBusy}>
              {cacheBusy ? 'Clearing…' : 'Clear cache'}
            </Button>
          </li>
          <li className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-medium text-slate-900">Check all health endpoints</p>
            <p className="mt-1 text-xs text-slate-600">Re-runs database, auth, storage, Redis, Stripe, and email checks.</p>
            <Button className="mt-2" size="sm" variant="secondary" onClick={() => void runChecks()} disabled={checksBusy}>
              {checksBusy ? 'Running…' : 'Run checks'}
            </Button>
          </li>
          <li className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-medium text-slate-900">Force refresh workspace settings</p>
            <p className="mt-1 text-xs text-slate-600">Triggers the existing admin refresh job for cached settings.</p>
            <Button
              className="mt-2"
              size="sm"
              variant="secondary"
              onClick={refreshSettings}
              disabled={refreshBusy}
            >
              Refresh settings
            </Button>
          </li>
        </ul>
        <Link
          href="/admin/audit"
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          View audit log →
        </Link>
        {msg ? <p className="mt-3 text-sm text-slate-700">{msg}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-medium text-slate-900">Recent audit (raw)</h2>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px] text-slate-600">
          {data.auditLogs.map((a) => (
            <li key={`${a.action}-${a.created_at}`}>
              {a.action} · {a.user_id ?? '—'} · {a.ip_address ?? '—'} · {new Date(a.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
