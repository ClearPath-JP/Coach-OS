'use client'

import { format, formatDistanceToNow, isThisYear } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  addAuditPreset,
  loadAuditPresets,
  removeAuditPreset,
  type AuditFilterPreset,
} from '@/lib/admin-audit-presets'
import {
  classifyAuditRisk,
  formatAuditDescription,
  type AuditDisplayContext,
} from '@/lib/admin-audit-messages'

type Row = {
  id: string
  action: string
  userEmail: string
  userName: string
  workspaceName: string
  workspaceId: string | null
  ip: string | null
  time: string
  metadata: Record<string, unknown>
}

type WorkspaceOpt = { id: string; name: string | null }

function initRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 86400000)
  return { from: start.toISOString(), to: now.toISOString() }
}

function exportCsv(events: Row[]) {
  const headers = ['time', 'action', 'description', 'user_email', 'workspace', 'ip']
  const lines = [headers.join(',')]
  for (const ev of events) {
    const ctx: AuditDisplayContext = {
      actorName: ev.userName,
      actorEmail: ev.userEmail,
      workspaceName: ev.workspaceName,
      targetEmail: typeof ev.metadata.email === 'string' ? ev.metadata.email : null,
      ip: ev.ip,
      coachLabel: ev.workspaceName || null,
    }
    const { text } = formatAuditDescription(ev.action, ev.metadata, ctx)
    const row = [
      ev.time,
      ev.action,
      text,
      ev.userEmail,
      ev.workspaceName || 'Platform',
      ev.ip ?? '',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`)
    lines.push(row.join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function WhenCell({ time }: { time: string }) {
  const d = new Date(time)
  const rel = formatDistanceToNow(d, { addSuffix: true })
  const abs = isThisYear(d)
    ? format(d, "MMM d 'at' h:mmaaa")
    : format(d, "MMM d, yyyy 'at' h:mmaaa")
  return (
    <span title={d.toISOString()}>
      <span className="text-slate-900">{rel}</span>
      <span className="mt-0.5 block text-[11px] text-slate-500">{abs}</span>
    </span>
  )
}

const pageSize = 50

export default function AdminAuditPage() {
  const initial = initRange()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [workspaces, setWorkspaces] = useState<WorkspaceOpt[]>([])

  const [draftCategory, setDraftCategory] = useState('all')
  const [draftQ, setDraftQ] = useState('')
  const [draftWorkspaceId, setDraftWorkspaceId] = useState('')
  const [draftFrom, setDraftFrom] = useState(initial.from)
  const [draftTo, setDraftTo] = useState(initial.to)
  const [rangePreset, setRangePreset] = useState<'today' | '7' | '30' | 'custom'>('30')

  const [appliedCategory, setAppliedCategory] = useState('all')
  const [appliedQ, setAppliedQ] = useState('')
  const [appliedWorkspaceId, setAppliedWorkspaceId] = useState('')
  const [appliedFrom, setAppliedFrom] = useState(initial.from)
  const [appliedTo, setAppliedTo] = useState(initial.to)

  const [savedPresets, setSavedPresets] = useState<AuditFilterPreset[]>([])
  const [newPresetName, setNewPresetName] = useState('')

  useEffect(() => {
    setSavedPresets(loadAuditPresets())
  }, [])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const qInit = sp.get('q')?.trim() ?? ''
    const cat = sp.get('category')?.trim() ?? ''
    const wsInit = sp.get('workspace_id')?.trim() ?? ''
    if (!qInit && !cat && !wsInit) return
    if (qInit) {
      setDraftQ(qInit)
      setAppliedQ(qInit)
    }
    if (cat && ['all', 'security', 'payments', 'data', 'admin'].includes(cat)) {
      setDraftCategory(cat)
      setAppliedCategory(cat)
    }
    if (wsInit) {
      setDraftWorkspaceId(wsInit)
      setAppliedWorkspaceId(wsInit)
    }
    setPage(1)
  }, [])

  const applyPreset = (preset: typeof rangePreset) => {
    setRangePreset(preset)
    const now = new Date()
    if (preset === 'custom') return
    const end = now.toISOString()
    let start: Date
    if (preset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (preset === '7') {
      start = new Date(now.getTime() - 7 * 86400000)
    } else {
      start = new Date(now.getTime() - 30 * 86400000)
    }
    setDraftFrom(start.toISOString())
    setDraftTo(end)
  }

  useEffect(() => {
    void fetch('/api/admin/workspaces-list')
      .then((r) => r.json())
      .then((json) => setWorkspaces(json.data ?? []))
  }, [])

  const fetchAudit = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('category', appliedCategory)
    if (appliedQ.trim()) params.set('q', appliedQ.trim())
    if (appliedWorkspaceId) params.set('workspace_id', appliedWorkspaceId)
    if (appliedFrom) params.set('from', appliedFrom)
    if (appliedTo) params.set('to', appliedTo)
    try {
      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      const json = await res.json()
      setRows(json.data?.events ?? [])
      setTotal(json.data?.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, appliedCategory, appliedQ, appliedWorkspaceId, appliedFrom, appliedTo])

  useEffect(() => {
    void fetchAudit()
  }, [fetchAudit])

  const applyFilters = () => {
    setAppliedCategory(draftCategory)
    setAppliedQ(draftQ)
    setAppliedWorkspaceId(draftWorkspaceId)
    setAppliedFrom(draftFrom)
    setAppliedTo(draftTo)
    setPage(1)
  }

  const saveCurrentView = () => {
    const name = newPresetName.trim()
    if (!name) return
    const preset: AuditFilterPreset = {
      name,
      category: appliedCategory,
      q: appliedQ,
      workspaceId: appliedWorkspaceId,
      from: appliedFrom,
      to: appliedTo,
      rangePreset,
    }
    setSavedPresets(addAuditPreset(preset))
    setNewPresetName('')
  }

  const loadSavedView = (p: AuditFilterPreset) => {
    setDraftCategory(p.category)
    setDraftQ(p.q)
    setDraftWorkspaceId(p.workspaceId)
    setDraftFrom(p.from)
    setDraftTo(p.to)
    setRangePreset(p.rangePreset)
    setAppliedCategory(p.category)
    setAppliedQ(p.q)
    setAppliedWorkspaceId(p.workspaceId)
    setAppliedFrom(p.from)
    setAppliedTo(p.to)
    setPage(1)
  }

  const deleteSavedView = (name: string) => {
    setSavedPresets(removeAuditPreset(name))
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900">Audit log</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Security events and important actions across all workspaces. Filter by time and workspace, export CSV for
            records. High-risk rows are highlighted when the table marks them.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => exportCsv(rows)}
          disabled={rows.length === 0}
        >
          Export CSV
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['today', 'Today'],
              ['7', 'Last 7 days'],
              ['30', 'Last 30 days'],
              ['custom', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                rangePreset === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs text-slate-500">Search (email or IP)</label>
            <Input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="user@ or 192.…" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Event type</label>
            <select
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
            >
              <option value="all">All events</option>
              <option value="security">Security</option>
              <option value="payments">Payments</option>
              <option value="data">Data changes</option>
              <option value="admin">Admin actions</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Workspace</label>
            <select
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={draftWorkspaceId}
              onChange={(e) => setDraftWorkspaceId(e.target.value)}
            >
              <option value="">All workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name ?? w.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" size="sm" onClick={() => applyFilters()}>
              Apply filters
            </Button>
          </div>
        </div>
        {rangePreset === 'custom' ? (
          <div className="flex flex-wrap gap-2">
            <div>
              <label className="block text-xs text-slate-500">From</label>
              <Input
                type="datetime-local"
                value={draftFrom ? draftFrom.slice(0, 16) : ''}
                onChange={(e) => setDraftFrom(new Date(e.target.value).toISOString())}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">To</label>
              <Input
                type="datetime-local"
                value={draftTo ? draftTo.slice(0, 16) : ''}
                onChange={(e) => setDraftTo(new Date(e.target.value).toISOString())}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs text-slate-500">Saved views (this browser)</label>
            <select
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value=""
              onChange={(e) => {
                const name = e.target.value
                if (!name) return
                const p = savedPresets.find((x) => x.name === name)
                if (p) loadSavedView(p)
                e.target.value = ''
              }}
            >
              <option value="">Load a saved view…</option>
              {savedPresets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-wrap items-end gap-2">
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Name for current filters"
              className="max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => saveCurrentView()}
              disabled={!newPresetName.trim()}
            >
              Save current view
            </Button>
          </div>
        </div>
        {savedPresets.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {savedPresets.map((p) => (
              <li
                key={p.name}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"
              >
                <button type="button" className="font-medium hover:underline" onClick={() => loadSavedView(p)}>
                  {p.name}
                </button>
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-600"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => deleteSavedView(p.name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">What happened</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Where</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Risk</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading events…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No events match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const risk = classifyAuditRisk(r.action)
                const ctx: AuditDisplayContext = {
                  actorName: r.userName,
                  actorEmail: r.userEmail,
                  workspaceName: r.workspaceName,
                  targetEmail: typeof r.metadata.email === 'string' ? r.metadata.email : null,
                  ip: r.ip,
                  coachLabel: r.workspaceName || null,
                }
                const { segments } = formatAuditDescription(r.action, r.metadata, ctx)
                const rowBg =
                  risk === 'high'
                    ? 'bg-red-50/80'
                    : risk === 'medium'
                      ? 'bg-amber-50/50'
                      : 'bg-white'
                const riskLabel =
                  risk === 'high' ? 'High' : risk === 'medium' ? 'Medium' : 'Low'
                const riskColor =
                  risk === 'high' ? 'text-red-600' : risk === 'medium' ? 'text-amber-700' : 'text-slate-500'
                return (
                  <tr key={r.id} className={`border-b border-slate-100 ${rowBg}`}>
                    <td className="max-w-md px-4 py-3 text-slate-800">
                      <p className="leading-snug">
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
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600">
                          {(r.userName || r.userEmail || 'A').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {r.userName || (r.userEmail ? r.userEmail.split('@')[0] : 'Anonymous')}
                          </p>
                          <p className="text-[11px] text-slate-500">{r.userEmail || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.workspaceName || <span className="text-slate-500">Platform</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <WhenCell time={r.time} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${riskColor}`}>● {riskLabel}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          Showing {startIdx}-{endIdx} of {total} events
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
