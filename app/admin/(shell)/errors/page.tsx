'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

type Row = {
  id: string
  workspace_id: string | null
  workspaceName: string
  user_id: string
  user_email: string | null
  role: string
  route_path: string | null
  error_message: string
  error_stack: string | null
  component_stack: string | null
  client_meta: Record<string, unknown>
  created_at: string
}

export default function AdminErrorLogsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    void (async () => {
      setLoading(true)
      const p = new URLSearchParams()
      p.set('limit', '150')
      if (role) p.set('role', role)
      const res = await fetch(`/api/admin/error-logs?${p.toString()}`)
      const json = await res.json()
      setRows(json.data ?? [])
      setLoading(false)
    })()
  }, [role])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Coach &amp; client errors</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="coach">Coach only</option>
            <option value="client">Client only</option>
          </select>
          <Button type="button" size="sm" variant="secondary" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Captures React crashes, uncaught JS errors, and unhandled promise rejections from coach and client apps (when
        the user is signed in). Cross-origin script errors may appear as &quot;Script error&quot; with no stack.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No error reports yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-red-800">{r.error_message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString()} ·{' '}
                    <span className="capitalize">{r.role}</span>
                    {r.user_email ? ` · ${r.user_email}` : ''} · {r.workspaceName}
                  </p>
                  {r.route_path ? (
                    <p className="mt-0.5 font-mono text-xs text-slate-600">{r.route_path}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:underline"
                  onClick={() => setExpanded((id) => (id === r.id ? null : r.id))}
                >
                  {expanded === r.id ? 'Hide details' : 'Stack / details'}
                </button>
              </div>
              {expanded === r.id ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                  {r.error_stack ? (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-800">
                      {r.error_stack}
                    </pre>
                  ) : null}
                  {r.component_stack ? (
                    <div>
                      <p className="font-medium text-slate-700">Component stack</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">
                        {r.component_stack}
                      </pre>
                    </div>
                  ) : null}
                  <p className="font-mono text-slate-600">user_id: {r.user_id}</p>
                  {r.workspace_id ? (
                    <p className="font-mono text-slate-600">workspace_id: {r.workspace_id}</p>
                  ) : null}
                  <pre className="max-h-32 overflow-auto rounded bg-slate-50 p-2 text-slate-700">
                    {JSON.stringify(r.client_meta, null, 2)}
                  </pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
