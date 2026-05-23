'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
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
import { cn } from '@/lib/utils'

const AssignmentAnalyticsCharts = dynamic(
  () => import('@/components/coach/AssignmentAnalyticsCharts').then((m) => m.AssignmentAnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 200,
          background: 'var(--cp-offwhite)',
          borderRadius: 10,
          border: '1px solid var(--cp-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cp-gray)',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    ),
  }
)

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const overdueFromUrl = searchParams.get('tab') === 'overdue'
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

  useEffect(() => {
    if (overdueFromUrl) setTab('all')
  }, [overdueFromUrl])

  const overdueOnlyRows = useMemo(() => {
    const now = Date.now()
    return rows.filter((r) => {
      if (!r.due_at || new Date(r.due_at).getTime() >= now) return false
      return r.status === 'pending' || r.status === 'overdue' || r.status === 'returned'
    })
  }, [rows])

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
          className="max-w-[220px] text-left text-[var(--cp-accent)] hover:underline"
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

  function queueInitials(name: string) {
    const p = name.trim().split(/\s+/)
    if (p.length >= 2) return `${p[0]?.[0] ?? ''}${p[p.length - 1]?.[0] ?? ''}`.toUpperCase().slice(0, 2)
    return name.slice(0, 2).toUpperCase() || '?'
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--coach-section-gap)]">
      <PageHeader title="Assignments">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          New template
        </Button>
      </PageHeader>

      {notice ? (
        <div
          role="status"
          className="rounded-[var(--radius-lg)] border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-[14px] text-[var(--success)]"
        >
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-0 border-b border-[var(--border-subtle)]">
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
            className={cn(
              'relative h-8 min-h-[32px] px-4 text-[14px] transition-colors duration-150',
              tab === k
                ? 'font-semibold text-[var(--cp-accent)] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-t after:bg-[var(--cp-accent)]'
                : 'font-normal text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
      ) : tab === 'review' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Review queue</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
              {queueRows.length} submission{queueRows.length === 1 ? '' : 's'} waiting
            </p>
          </div>
          {queueRows.length === 0 ? (
            <Card className="border border-[var(--border-default)] bg-[var(--bg-subtle)] p-10 text-center shadow-[var(--shadow-xs)]">
              <p className="text-[20px]" aria-hidden>
                🎉
              </p>
              <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">All caught up!</p>
              <p className="mt-1 text-[14px] text-[var(--text-tertiary)]">No assignments waiting for review.</p>
            </Card>
          ) : (
            queueRows.map((r) => (
              <Card
                key={r.id}
                className="flex flex-wrap items-center gap-4 border border-[var(--border-default)] p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[13px] font-semibold text-[var(--cp-accent)]">
                  {queueInitials(fullName(r.clients))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">{fullName(r.clients)}</p>
                  <button
                    type="button"
                    className="text-left text-[13px] text-[var(--text-tertiary)] hover:text-[var(--cp-accent)] hover:underline"
                    onClick={() =>
                      openTemplateSubmissions(
                        r.assignment_template_id,
                        r.assignment_templates?.title ?? 'Assignment'
                      )
                    }
                  >
                    {r.assignment_templates?.title}
                  </button>
                  <p className="mt-0.5 text-[12px] text-[var(--text-quaternary)]">
                    {r.submitted_at
                      ? `Submitted ${formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}`
                      : r.due_at && new Date(r.due_at) < new Date()
                        ? `Overdue ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                        : null}
                  </p>
                  <Badge variant="pending" className="mt-2 text-[11px]">
                    {r.assignment_templates?.assignment_type ?? '—'}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.status === 'submitted' ? (
                    <Button type="button" size="sm" onClick={() => openReview(r)}>
                      Review
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {!loading ? (
        <Card className="space-y-3 border border-[var(--border-default)] p-4 shadow-[var(--shadow-xs)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Send to a client</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
              Delivers in <strong className="font-medium text-[var(--text-secondary)]">Messages</strong> and on their
              Assignments page. They need an email on file to log in.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[14px] sm:max-w-xs"
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
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[14px] sm:max-w-xs"
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
              {quickBusy ? 'Sending…' : 'Send assignment'}
            </Button>
          </div>
          {quickError ? <p className="text-[13px] text-[var(--error)]">{quickError}</p> : null}
        </Card>
      ) : null}

      {!loading && tab === 'all' ? (
        <>
          {overdueFromUrl ? (
            <p className="mb-3 text-[13px] text-[var(--text-secondary)]">
              Showing overdue assignments only.{' '}
              <button
                type="button"
                className="font-medium text-[var(--cp-accent)] underline"
                onClick={() => {
                  router.replace('/coach/assignments')
                  setTab('all')
                }}
              >
                Show all
              </button>
            </p>
          ) : null}
          <DataTable
            columns={columns}
            rows={overdueFromUrl ? overdueOnlyRows : rows}
            emptyTitle={overdueFromUrl ? 'No overdue assignments' : 'No assignments yet'}
            emptyDescription={
              overdueFromUrl
                ? 'Assignments past due appear here.'
                : 'Create a template and assign it to a client from the Templates tab.'
            }
          />
        </>
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
            Templates are reusable assignment definitions. After you save one, it appears here and in{' '}
            <strong className="font-medium">Send to a client</strong> below. Use the Templates tab to assign or delete.
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
                className="w-full text-left font-medium text-[var(--text-primary)] hover:text-[var(--cp-accent)]"
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
        <AssignmentAnalyticsCharts
          completionRatePct={overview.completionRatePct}
          topClientsByXp={overview.topClientsByXp}
        />
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
