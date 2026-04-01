'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { CreateAssignmentTemplateModal } from '@/components/coach/CreateAssignmentTemplateModal'
import { AssignmentReviewModal } from '@/components/coach/AssignmentReviewModal'
import {
  AssignmentTemplateSubmissionsModal,
  type AssignmentSubmissionRow,
} from '@/components/coach/AssignmentTemplateSubmissionsModal'
import { Skeleton } from '@/components/ui/Skeleton'

type Tab = 'review' | 'all' | 'templates' | 'analytics'

type Row = AssignmentSubmissionRow & { created_at: string }

type TemplateRow = {
  id: string
  title: string
  assignment_type: string
  points: number
  assignCount?: number
}

export function AssignmentsPageContent() {
  const [tab, setTab] = useState<Tab>('review')
  const [rows, setRows] = useState<Row[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [overview, setOverview] = useState<{
    pendingReviewCount: number
    overdueCount: number
    completionRatePct: number
    topClientsByXp: { clientId: string; name: string; totalXp: number; level: number }[]
  } | null>(null)
  const [clients, setClients] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [reviewName, setReviewName] = useState('')
  const [reviewPoints, setReviewPoints] = useState(10)
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null)
  const [assignClientId, setAssignClientId] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignModalError, setAssignModalError] = useState<string | null>(null)
  const [quickTemplateId, setQuickTemplateId] = useState('')
  const [quickClientId, setQuickClientId] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [submissionsTemplate, setSubmissionsTemplate] = useState<{ id: string; title: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setTemplatesError(null)
    try {
      const [allRes, tplRes, ovRes, clRes] = await Promise.all([
        fetch('/api/assignments/all'),
        fetch('/api/assignments/templates'),
        fetch('/api/assignments/overview'),
        fetch('/api/clients'),
      ])
      const [allJ, tplJ, ovJ, clJ] = await Promise.all([
        allRes.json(),
        tplRes.json(),
        ovRes.json(),
        clRes.json(),
      ])
      if (allRes.ok) setRows(allJ.data ?? [])
      if (tplRes.ok) {
        setTemplates(tplJ.data ?? [])
      } else {
        setTemplates([])
        setTemplatesError(tplJ.error ?? 'Could not load templates')
      }
      if (ovRes.ok) setOverview(ovJ.data ?? null)
      if (clRes.ok) setClients(clJ.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const queueRows = useMemo(() => {
    const now = Date.now()
    return rows.filter((r) => {
      if (r.status === 'submitted') return true
      if ((r.status === 'pending' || r.status === 'returned') && r.due_at && new Date(r.due_at).getTime() < now)
        return true
      return false
    })
  }, [rows])

  const fullName = (c: { first_name: string | null; last_name: string | null } | null) =>
    [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Client'

  const openReview = (r: Pick<Row, 'id' | 'clients' | 'assignment_templates'>) => {
    setReviewId(r.id)
    setReviewName(fullName(r.clients))
    setReviewPoints(r.assignment_templates?.points ?? 10)
  }

  const openTemplateSubmissions = (templateId: string, title: string) => {
    setSubmissionsTemplate({ id: templateId, title })
  }

  const columns: DataColumn<Row>[] = [
    { key: 'client', header: 'Client', render: (r) => fullName(r.clients) },
    {
      key: 'assignment',
      header: 'Assignment',
      render: (r) => (
        <button
          type="button"
          className="max-w-[220px] text-left text-[var(--accent)] hover:underline"
          onClick={() =>
            openTemplateSubmissions(r.assignment_template_id, r.assignment_templates?.title ?? 'Assignment')
          }
        >
          {r.assignment_templates?.title ?? '—'}
        </button>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <Badge variant="pending">{r.assignment_templates?.assignment_type ?? '—'}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={r.status === 'approved' ? 'active' : 'pending'}>{r.status}</Badge>,
    },
    {
      key: 'due',
      header: 'Due',
      render: (r) => (r.due_at ? formatDistanceToNow(new Date(r.due_at), { addSuffix: true }) : '—'),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (r) =>
        r.submitted_at ? formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true }) : '—',
    },
    { key: 'points', header: 'Points', render: (r) => r.points_awarded },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) =>
        r.status === 'submitted' ? (
          <Button type="button" size="sm" onClick={() => openReview(r)}>
            Review
          </Button>
        ) : (
          '—'
        ),
    },
  ]

  const pieData = overview
    ? [
        { name: 'Done', value: overview.completionRatePct },
        { name: 'Rest', value: Math.max(0, 100 - overview.completionRatePct) },
      ]
    : []

  const sendAssignment = async (templateId: string, clientId: string) => {
    const res = await fetch('/api/assignments/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, clientId }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; data?: unknown }
    return { res, json }
  }

  const assign = async () => {
    if (!assignTemplateId || !assignClientId) return
    setAssignBusy(true)
    setAssignModalError(null)
    try {
      const { res, json } = await sendAssignment(assignTemplateId, assignClientId)
      if (res.ok || res.status === 207) {
        setAssignTemplateId(null)
        setAssignClientId('')
        setNotice(
          res.status === 207
            ? json.error ?? 'Assignment created; check Messages if the client did not get a notification.'
            : 'Sent — your client will see this in Messages and on their Assignments page.'
        )
        void load()
      } else {
        setAssignModalError(json.error ?? 'Could not send assignment')
      }
    } finally {
      setAssignBusy(false)
    }
  }

  const quickAssign = async () => {
    if (!quickTemplateId || !quickClientId) return
    setQuickBusy(true)
    setQuickError(null)
    try {
      const { res, json } = await sendAssignment(quickTemplateId, quickClientId)
      if (res.ok || res.status === 207) {
        setNotice(
          res.status === 207
            ? json.error ?? 'Assignment created; check Messages if needed.'
            : 'Sent — your client will see this in Messages and on their Assignments page.'
        )
        void load()
      } else {
        setQuickError(json.error ?? 'Could not send assignment')
      }
    } finally {
      setQuickBusy(false)
    }
  }

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(t)
  }, [notice])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 lg:p-8">
      <PageHeader title="Assignments">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          New template
        </Button>
      </PageHeader>

      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </div>
      ) : null}

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Send to a client</h2>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Delivers the assignment in <strong className="font-medium">Messages</strong> and lists it on the client&apos;s
            Assignments page. The client needs a login (email on file).
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 text-sm sm:max-w-xs"
            value={quickTemplateId}
            onChange={(e) => setQuickTemplateId(e.target.value)}
            disabled={loading || templates.length === 0}
            aria-label="Assignment template"
          >
            <option value="">{templates.length === 0 ? 'Create a template first' : 'Choose template'}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 text-sm sm:max-w-xs"
            value={quickClientId}
            onChange={(e) => setQuickClientId(e.target.value)}
            disabled={loading || clients.length === 0}
            aria-label="Client"
          >
            <option value="">{clients.length === 0 ? 'Add a client first' : 'Choose client'}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client'}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={quickBusy || !quickTemplateId || !quickClientId}
            onClick={() => void quickAssign()}
          >
            {quickBusy ? 'Sending…' : 'Send'}
          </Button>
        </div>
        {quickError ? <p className="text-sm text-red-600">{quickError}</p> : null}
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-2">
        {(
          [
            ['review', 'Review queue'],
            ['all', 'All assignments'],
            ['templates', 'Templates'],
            ['analytics', 'Analytics'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === k ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : tab === 'review' ? (
        <div className="space-y-3">
          {queueRows.length === 0 ? (
            <Card className="p-8 text-center text-[var(--text-secondary)]">
              All caught up! No assignments pending review.
            </Card>
          ) : (
            queueRows.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{fullName(r.clients)}</p>
                  <button
                    type="button"
                    className="text-left text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] hover:underline"
                    onClick={() =>
                      openTemplateSubmissions(
                        r.assignment_template_id,
                        r.assignment_templates?.title ?? 'Assignment'
                      )
                    }
                  >
                    {r.assignment_templates?.title}
                  </button>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {r.submitted_at
                      ? `Submitted ${formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}`
                      : r.due_at && new Date(r.due_at) < new Date()
                        ? `Overdue ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                        : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="pending">{r.assignment_templates?.assignment_type}</Badge>
                  {r.status === 'submitted' ? (
                    <Button type="button" onClick={() => openReview(r)}>
                      Review
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {!loading && tab === 'all' ? (
        <DataTable
          columns={columns}
          rows={rows}
          emptyTitle="No assignments yet"
          emptyDescription="Create a template and assign it to a client from the Templates tab."
        />
      ) : null}

      {!loading && tab === 'templates' && templatesError ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Could not load templates</p>
          <p className="mt-1 text-amber-900">{templatesError}</p>
          <Button type="button" variant="secondary" className="mt-3" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : null}

      {!loading && tab === 'templates' && !templatesError && templates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium text-[var(--text-primary)]">No templates yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
            Templates are reusable assignment definitions. After you save one, it appears here and in the &quot;Send to a
            client&quot; bar above. Open the <strong className="font-medium">Templates</strong> tab to assign or delete.
          </p>
          <Button type="button" className="mt-4" onClick={() => setCreateOpen(true)}>
            Create your first template
          </Button>
        </Card>
      ) : null}

      {!loading && tab === 'templates' && !templatesError && templates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="space-y-3 p-4">
              <button
                type="button"
                className="w-full text-left font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                onClick={() => openTemplateSubmissions(t.id, t.title)}
              >
                {t.title}
                <span className="mt-0.5 block text-xs font-normal text-[var(--text-tertiary)]">
                  View who submitted
                </span>
              </button>
              <div className="flex flex-wrap gap-1">
                <Badge variant="pending">{t.assignment_type}</Badge>
                <Badge variant="active">{t.points} XP</Badge>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Assigned {t.assignCount ?? 0} times</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAssignModalError(null)
                    setAssignClientId('')
                    setAssignTemplateId(t.id)
                  }}
                >
                  Assign to client
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm('Delete this template?')) return
                    await fetch(`/api/assignments/templates/${t.id}`, { method: 'DELETE' })
                    void load()
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && tab === 'analytics' && overview ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-medium">Completion rate</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={2}>
                    <Cell fill="var(--accent)" />
                    <Cell fill="var(--border-default)" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-[var(--text-secondary)]">{overview.completionRatePct}% completed</p>
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-medium">Top clients by XP</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.topClientsByXp.slice(0, 5)}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="totalXp" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : null}

      <CreateAssignmentTemplateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setTab('templates')
          setNotice('Template saved. Use “Send to a client” above or Assign on a card to deliver it.')
          void load()
        }}
      />

      {reviewId ? (
        <AssignmentReviewModal
          open={!!reviewId}
          onClose={() => setReviewId(null)}
          clientAssignmentId={reviewId}
          clientName={reviewName}
          defaultPoints={reviewPoints}
          onReviewed={() => void load()}
        />
      ) : null}

      {submissionsTemplate ? (
        <AssignmentTemplateSubmissionsModal
          open
          onClose={() => setSubmissionsTemplate(null)}
          templateId={submissionsTemplate.id}
          templateTitle={submissionsTemplate.title}
          rows={rows}
          onReview={(r) => {
            setSubmissionsTemplate(null)
            openReview(r)
          }}
        />
      ) : null}

      {assignTemplateId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-3 p-4">
            <p className="font-medium">Assign template</p>
            <p className="text-xs text-[var(--text-tertiary)]">Sends to the client&apos;s Messages and Assignments.</p>
            <select
              className="h-10 w-full rounded-lg border border-[var(--border-default)] px-3"
              value={assignClientId}
              onChange={(e) => {
                setAssignClientId(e.target.value)
                setAssignModalError(null)
              }}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Client'}
                </option>
              ))}
            </select>
            {assignModalError ? <p className="text-sm text-red-600">{assignModalError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAssignTemplateId(null)
                  setAssignModalError(null)
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={assignBusy || !assignClientId} onClick={() => void assign()}>
                {assignBusy ? 'Sending…' : 'Send assignment'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
