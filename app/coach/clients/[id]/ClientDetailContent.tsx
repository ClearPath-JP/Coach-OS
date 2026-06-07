'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { differenceInDays, eachWeekOfInterval, endOfWeek, format, isWithinInterval, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { Flame } from 'lucide-react'
import { getLevelFromXp } from '@/lib/xp-system'
import { ClientDailyCheckinsCoachSection } from '@/components/coach/ClientDailyCheckinsCoachSection'
import { AssignProgramToClientModal } from '@/components/coach/AssignProgramToClientModal'
import { ClientGoalsTab } from '@/components/coach/ClientGoalsTab'
import { QuickInvoiceModal } from '@/components/coach/QuickInvoiceModal'
import { RecordPaymentModal } from '@/components/coach/RecordPaymentModal'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_STYLES,
  type PaymentMethodValue,
} from '@/lib/payment-methods'
import { calculateEngagementScore, engagementLabelText } from '@/lib/client-engagement'
import { formatCents } from '@/lib/format-currency'
import type { SessionActionItemRow } from '@/lib/sessions/action-items'

type ClientPaymentRow = {
  id: string
  amount_cents: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
}

type ClientRewards = {
  total_xp: number
  level: number
  current_streak_days: number
  longest_streak_days: number
  assignments_completed: number
  assignments_total: number
  last_activity_at: string | null
} | null

type EngagementInfo = ReturnType<typeof calculateEngagementScore>

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
  rewards?: ClientRewards
  engagement?: EngagementInfo
}

type CoachAssignmentRow = {
  id: string
  status: string
  reviewed_at: string | null
  points_awarded: number | null
  coach_feedback: string | null
  assignment_templates: { title: string; points: number } | null
}

function assignmentTitle(row: CoachAssignmentRow): string {
  return row.assignment_templates?.title?.trim() || 'Assignment'
}

function ClientProgressPanel({
  rewards,
  assignRows,
  loading,
}: {
  rewards: ClientRewards
  assignRows: CoachAssignmentRow[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-border)]/40" />
        ))}
      </div>
    )
  }

  const xp = rewards?.total_xp ?? 0
  const levelInfo = getLevelFromXp(xp)
  const totalA = rewards?.assignments_total ?? 0
  const doneA = rewards?.assignments_completed ?? 0
  const completionPct = totalA > 0 ? Math.round((doneA / totalA) * 100) : 0
  const now = new Date()
  const rangeStart = startOfWeek(subWeeks(now, 5))
  const weeks = eachWeekOfInterval({ start: rangeStart, end: now })
  const counts = weeks.map((wStart) => {
    const wEnd = endOfWeek(wStart)
    return assignRows.filter(
      (r) =>
        r.status === 'approved' &&
        r.reviewed_at &&
        isWithinInterval(parseISO(r.reviewed_at), { start: wStart, end: wEnd })
    ).length
  })
  const maxCount = Math.max(1, ...counts)
  const recentApproved = assignRows.filter((r) => r.status === 'approved').slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="raised" padding="lg">
          <h2 className="mb-2 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">XP and level</h2>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{xp} XP</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Level {levelInfo.level}: {levelInfo.name}
          </p>
        </Card>
        <Card variant="raised" padding="lg">
          <h2 className="mb-2 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">Assignments</h2>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{completionPct}%</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {doneA} completed of {totalA} assigned
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Streak: {rewards?.current_streak_days ?? 0}d (best {rewards?.longest_streak_days ?? 0}d)
          </p>
        </Card>
      </div>

      <Card variant="raised" padding="lg">
        <h2 className="mb-4 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
          Approvals by week
        </h2>
        <div className="flex h-36 items-end gap-2">
          {weeks.map((wStart, i) => {
            const c = counts[i] ?? 0
            const barH = 6 + Math.round((c / maxCount) * 110)
            return (
              <div key={wStart.toISOString()} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full max-w-[40px] rounded-t bg-[var(--color-accent)]"
                  style={{ height: barH }}
                  title={`${c} approved`}
                />
                <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                  {wStart.getMonth() + 1}/{wStart.getDate()}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card variant="raised" padding="lg">
        <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
          Recently completed
        </h2>
        {recentApproved.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No approved assignments yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentApproved.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] py-2 last:border-0"
              >
                <span className="font-medium text-[var(--color-ink)]">{assignmentTitle(r)}</span>
                <span className="text-sm text-[var(--color-muted)] tabular-nums">+{r.points_awarded ?? 0} XP</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function statusBadgeVariant(s: string): 'active' | 'inactive' | 'pending' {
  if (s === 'active') return 'active'
  if (s === 'paused') return 'pending'
  return 'inactive'
}

type SessionNotesHistoryRow = {
  sessionId: string
  scheduledTime: string
  sessionSummary: string | null
  notesSentAt: string | null
  actionItemsTotal: number
  actionItemsCompleted: number
  actionItems: SessionActionItemRow[]
}

function RecentSessionNotesSection({ clientId }: { clientId: string }) {
  const [sessions, setSessions] = useState<SessionNotesHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/session-notes-history`)
        const json = (await res.json()) as { data?: { sessions?: SessionNotesHistoryRow[] } }
        if (!cancelled && res.ok && json.data?.sessions) {
          setSessions(json.data.sessions)
        } else if (!cancelled) {
          setSessions([])
        }
      } catch {
        if (!cancelled) setSessions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (loading) {
    return (
      <Card variant="raised" padding="lg">
        <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
          Recent session notes
        </h2>
        <div className="h-20 animate-pulse rounded-lg bg-[var(--color-border)]/40" />
      </Card>
    )
  }

  if (sessions.length === 0) {
    return null
  }

  return (
    <Card variant="raised" padding="lg">
      <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
        Recent session notes
      </h2>
      <ul className="space-y-2">
        {sessions.map((s) => {
          const preview = (s.sessionSummary ?? '').trim().slice(0, 80)
          const more = (s.sessionSummary ?? '').trim().length > 80 ? '…' : ''
          const open = expanded === s.sessionId
          const clientItems = s.actionItems.filter((i) => i.assigned_to === 'client')
          return (
            <li key={s.sessionId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
              <button
                type="button"
                onClick={() => setExpanded((id) => (id === s.sessionId ? null : s.sessionId))}
                className="flex w-full min-h-[44px] flex-col items-start gap-1 px-4 py-3 text-left"
              >
                <span className="text-[13px] font-medium text-[var(--color-ink)]">
                  {format(parseISO(s.scheduledTime), 'MMMM d, yyyy')}
                </span>
                <span className="text-[14px] text-[var(--color-muted)]">
                  {preview}
                  {more}
                </span>
                <span className="text-[12px] text-[var(--color-muted)]">
                  Action items: {s.actionItemsCompleted} of {s.actionItemsTotal} complete
                </span>
              </button>
              {open ? (
                <div className="border-t border-[var(--color-border)] px-4 py-3">
                  <p className="whitespace-pre-wrap text-[15px] text-[var(--color-text-primary)]">
                    {s.sessionSummary?.trim() || '—'}
                  </p>
                  {clientItems.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {clientItems.map((item) => (
                        <li
                          key={item.id}
                          className="text-[14px] text-[var(--color-muted)]"
                        >
                          {item.completed ? '☑' : '☐'} {item.text}
                          {item.completed ? (
                            <span className="ml-2" style={{ color: 'var(--success)' }}>
                              Done
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

const CLIENT_TABS: TabItem<'overview' | 'goals' | 'payments' | 'progress'>[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'goals', label: 'Goals' },
  { value: 'payments', label: 'Payments' },
  { value: 'progress', label: 'Progress' },
]

export function ClientDetailContent({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [clientPrograms, setClientPrograms] = useState<{ programId: string; title: string; status: string; totalModules: number; modulesCompleted: number; assignedAt: string }[]>([])
  const [assignProgramOpen, setAssignProgramOpen] = useState(false)
  const [tab, setTab] = useState<'overview' | 'goals' | 'payments' | 'progress'>('overview')
  const [assignRows, setAssignRows] = useState<CoachAssignmentRow[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentsTotal, setPaymentsTotal] = useState<number | null>(null)
  const [paymentRows, setPaymentRows] = useState<ClientPaymentRow[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteAckIrreversible, setDeleteAckIrreversible] = useState(false)
  const [deleteNameConfirm, setDeleteNameConfirm] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false)

  const loadPaymentsTab = useCallback(async () => {
    setPaymentsLoading(true)
    try {
      const [sumRes, listRes] = await Promise.all([
        fetch(`/api/payments/summary?period=all&clientId=${encodeURIComponent(clientId)}`),
        fetch(`/api/payments?clientId=${encodeURIComponent(clientId)}`),
      ])
      const sumJson = await sumRes.json()
      const listJson = await listRes.json()
      if (sumJson.data) setPaymentsTotal(sumJson.data.totalRevenue ?? 0)
      if (Array.isArray(listJson.data)) setPaymentRows(listJson.data)
    } catch {
      setPaymentsTotal(null)
      setPaymentRows([])
    } finally {
      setPaymentsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (tab === 'payments') loadPaymentsTab()
  }, [tab, loadPaymentsTab])

  useEffect(() => {
    if (tab !== 'progress') return
    let cancelled = false
    setAssignLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/assignments/client/${encodeURIComponent(clientId)}`)
        const json = await res.json()
        if (cancelled) return
        if (res.ok && Array.isArray(json.data)) {
          setAssignRows(json.data as CoachAssignmentRow[])
        } else {
          setAssignRows([])
        }
      } catch {
        if (!cancelled) setAssignRows([])
      } finally {
        if (!cancelled) setAssignLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, clientId])

  const fetchClient = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "We couldn't find that client")
        setClient(null)
        return
      }
      setClient(json.data)
      setNotes(json.data.notes ?? '')
      const progRes = await fetch(`/api/clients/${clientId}/programs`)
      const progJson = await progRes.json()
      if (progRes.ok && progJson.data) setClientPrograms(progJson.data)
    } catch {
      setError('Something went wrong — check your connection and try again')
      setClient(null)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const updateStatus = async (newStatus: 'active' | 'paused' | 'completed') => {
    if (!client || client.status === newStatus) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setClient((prev) => (prev ? { ...prev, status: json.data.status } : null))
      }
    } finally {
      setStatusUpdating(false)
    }
  }

  const sendInvite = async () => {
    if (!client?.email || inviteSent || inviteSending) return
    setInviteSending(true)
    setToast(null)
    try {
      const res = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: client.email }),
      })
      const json = await res.json()
      if (res.ok) {
        setToast(`Invite sent to ${client.email}`)
        setInviteSent(true)
      } else {
        setToast(json.error ?? 'Could not send invite')
        if (json.error?.toLowerCase().includes('already has an account')) {
          setInviteSent(true)
        }
      }
    } catch {
      setToast('Something went wrong — try again')
    } finally {
      setInviteSending(false)
    }
  }

  const saveNotes = async () => {
    if (!client) return
    setNotesSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setClient((prev) => (prev ? { ...prev, notes: json.data.notes } : null))
      }
    } finally {
      setNotesSaving(false)
    }
  }

  const fullName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed client'
    : ''

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-32 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--color-border)]" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card className="h-48 animate-pulse" />
            <Card className="h-32 animate-pulse" />
          </div>
          <div className="space-y-4">
            <Card className="h-24 animate-pulse" />
            <Card className="h-40 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Link
          href="/coach/clients"
          className="inline-flex items-center gap-1 text-[15px] text-[var(--color-accent)] hover:underline"
        >
          ← Back to Clients
        </Link>
        <Card className="rounded-xl border border-[var(--color-border)] p-8 text-center">
          <p className="text-[var(--color-text-primary)]">
            {error ?? "We couldn't find that client — it may have been deleted."}
          </p>
          <Link href="/coach/clients">
            <Button variant="secondary" className="mt-4">
              Back to clients
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  const daysAsClient = differenceInDays(new Date(), new Date(client.created_at))
  const statusOptions: ('active' | 'paused' | 'completed')[] = ['active', 'paused', 'completed']

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/coach/clients"
          className="inline-flex items-center gap-1 text-[15px] text-[var(--color-accent)] hover:underline"
        >
          ← Back to Clients
        </Link>
      </div>

      {/* ── Profile Header Banner ── */}
      <Card variant="elevated" padding="lg" className="card-glow overflow-hidden !p-0">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[20px] font-bold text-white ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-subtle)]">
            {(client.first_name?.[0] ?? '').toUpperCase()}{(client.last_name?.[0] ?? '').toUpperCase() || ''}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">{fullName}</h1>
              <Badge variant={statusBadgeVariant(client.status)}>{client.status}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              {client.email || 'No email'}{client.phone ? ` · ${client.phone}` : ''}
            </p>
            <p className="text-[12px] text-[var(--text-quaternary)]">
              Member since {format(new Date(client.created_at), 'MMM yyyy')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="min-h-[44px]" onClick={() => setQuickInvoiceOpen(true)}>
              Send Invoice
            </Button>
            {tab === 'payments' && (
              <Button type="button" className="min-h-[44px]" onClick={() => setPaymentModalOpen(true)}>
                Record payment
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">Member</p>
          <p className="mt-1.5 text-[24px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{daysAsClient}</p>
          <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">days</p>
        </div>
        <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">Assignments</p>
          <p className="mt-1.5 text-[24px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{client.rewards?.assignments_completed ?? 0}<span className="text-[14px] font-medium text-[var(--text-tertiary)]">/{client.rewards?.assignments_total ?? 0}</span></p>
          <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">completed</p>
        </div>
        <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">Program</p>
          <p className="mt-1.5 truncate text-[14px] font-semibold text-[var(--text-primary)]">{clientPrograms[0]?.title ?? '—'}</p>
          <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">{clientPrograms.length > 0 ? 'active' : 'none assigned'}</p>
        </div>
        <div className="card-glow rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-quaternary)]">XP / Level</p>
          <p className="mt-1.5 text-[24px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{client.rewards?.total_xp ?? 0}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <p className="text-[11px] text-[var(--text-quaternary)]">Level {client.rewards?.level ?? 1}</p>
            {(client.rewards?.current_streak_days ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                <Flame size={11} className="shrink-0" />
                {client.rewards?.current_streak_days}d
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs tabs={CLIENT_TABS} value={tab} onChange={setTab} ariaLabel="Client sections" />

      {tab === 'goals' && client && (
        <ClientGoalsTab
          clientId={clientId}
          clientFirstName={client.first_name ?? ''}
          fullName={fullName}
        />
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <Card variant="raised" padding="lg">
            <p className="text-[14px] text-[var(--color-muted)]">Total received from this client</p>
            <p className="mt-1 text-xl font-medium text-[var(--color-ink)]">
              {paymentsLoading ? '…' : paymentsTotal === null ? '—' : formatCents(paymentsTotal)}
            </p>
          </Card>
          {paymentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-border)]/50" />
              ))}
            </div>
          ) : paymentRows.length === 0 ? (
            <Card variant="raised" padding="lg" className="text-center">
              <p className="text-[15px] text-[var(--color-ink)]">No payments recorded for this client yet.</p>
              <Button type="button" className="mt-4 min-h-[44px]" onClick={() => setPaymentModalOpen(true)}>
                Record payment
              </Button>
            </Card>
          ) : (
            <ul className="space-y-3">
              {paymentRows.map((p) => (
                <li key={p.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-medium text-[var(--color-ink)]">{formatCents(p.amount_cents)}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${
                        PAYMENT_METHOD_STYLES[p.payment_method as PaymentMethodValue] ?? 'bg-neutral-200'
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethodValue] ?? p.payment_method}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[var(--color-muted)]">{p.payment_date ? format(parseISO(p.payment_date), 'MMM d, yyyy') : '—'}</p>
                  {p.payment_reference ? (
                    <p className="mt-1 text-[14px] text-[var(--color-muted)]">Ref: {p.payment_reference}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'progress' && (
        <ClientProgressPanel rewards={client.rewards ?? null} assignRows={assignRows} loading={assignLoading} />
      )}

      {tab === 'overview' && (
      <>
      <ClientDailyCheckinsCoachSection clientId={clientId} />

      <RecentSessionNotesSection clientId={clientId} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="raised" padding="lg">
            <h2 className="mb-4 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
              Contact & details
            </h2>
            <dl className="grid gap-3 text-[15px]">
              <div>
                <dt className="text-[var(--color-text-secondary)]">Email</dt>
                <dd className="mt-0.5 text-[var(--color-text-primary)]">{client.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-secondary)]">Phone</dt>
                <dd className="mt-0.5 text-[var(--color-text-primary)]">{client.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-secondary)]">Goals</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-[var(--color-text-primary)]">
                  {client.goals || '—'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="mb-4 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
              Notes
            </h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Coach-only notes…"
              rows={4}
              disabled={notesSaving}
            />
            <Button
              variant="secondary"
              className="mt-3"
              onClick={saveNotes}
              disabled={notesSaving || notes === (client.notes ?? '')}
            >
              {notesSaving ? 'Saving…' : 'Save notes'}
            </Button>
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-4">
          <Card variant="raised" padding="lg">
            <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
              Status
            </h2>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => updateStatus(s)}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-[14px] font-medium capitalize transition-colors disabled:opacity-50 ${
                    client.status === s
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
              Portal access
            </h2>
            {client.email ? (
              <>
                <Button
                  variant="secondary"
                  fullWidth
                  className="min-h-[44px]"
                  disabled={inviteSent || inviteSending}
                  onClick={sendInvite}
                >
                  {inviteSending ? 'Sending…' : inviteSent ? 'Invite sent' : 'Send invite'}
                </Button>
                {toast && (
                  <p className={`mt-2 text-[14px] ${inviteSent ? 'text-[var(--color-muted)]' : 'text-[var(--color-error)]'}`}>
                    {toast}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[14px] text-[var(--color-muted)]">
                Add an email to send a portal invite.
              </p>
            )}
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
              Quick stats
            </h2>
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)]">Days as client</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">{daysAsClient}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-secondary)]">Programs</dt>
                <dd className="font-medium text-[var(--color-text-primary)]">{clientPrograms.length}</dd>
              </div>
            </dl>
          </Card>

          <Card variant="raised" padding="lg">
            <h2 className="mb-3 text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
              Programs
            </h2>
            {clientPrograms.length === 0 ? (
              <p className="text-[14px] text-[var(--color-muted)] mb-3">
                No programs assigned yet.
              </p>
            ) : (
              <ul className="space-y-3 mb-3">
                {clientPrograms.map((cp) => {
                  const pct = cp.totalModules > 0 ? Math.round((cp.modulesCompleted / cp.totalModules) * 100) : 0
                  return (
                    <li key={cp.programId}>
                      <Link
                        href={`/coach/programs/${cp.programId}`}
                        className="block rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface)]"
                      >
                        <span className="font-medium text-[var(--color-ink)]">{cp.title}</span>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--color-accent)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {cp.modulesCompleted} of {cp.totalModules} modules
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <Button
              variant="secondary"
              fullWidth
              className="min-h-[44px]"
              onClick={() => setAssignProgramOpen(true)}
            >
              Assign program
            </Button>
          </Card>
        </div>
      </div>

      <Card
        variant="raised"
        padding="lg"
        className="border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20"
      >
        <h2 className="mb-2 text-[var(--text-15)] font-semibold tracking-[0] text-red-800 dark:text-red-200">
          Danger zone
        </h2>
        <p className="mb-4 text-[14px] text-[var(--color-muted)]">
          Permanently remove this client and all associated data. This cannot be undone.
        </p>
        <Button
          type="button"
          variant="danger"
          className="min-h-[44px]"
          onClick={() => {
            setDeleteAckIrreversible(false)
            setDeleteNameConfirm('')
            setDeleteModalOpen(true)
          }}
        >
          Delete client
        </Button>
      </Card>
      </>
      )}

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (deleteBusy) return
          setDeleteModalOpen(false)
          setDeleteAckIrreversible(false)
          setDeleteNameConfirm('')
        }}
        title={`Delete ${fullName}?`}
      >
        <p className="text-[15px] leading-relaxed text-[var(--color-text-primary)]">
          This will permanently delete this client and all their data including messages, sessions, programs, and
          assignments. This cannot be undone.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14px] text-[var(--color-ink)]">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border-[var(--color-border)]"
            checked={deleteAckIrreversible}
            onChange={(e) => setDeleteAckIrreversible(e.target.checked)}
            disabled={deleteBusy}
          />
          <span>I understand this cannot be undone</span>
        </label>
        <p className="mt-4 text-[14px] text-[var(--color-muted)]">
          Type <span className="font-medium text-[var(--color-ink)]">{(client.first_name ?? '').trim() || 'first name'}</span> to
          confirm.
        </p>
        <Input
          className="mt-2"
          value={deleteNameConfirm}
          onChange={(e) => setDeleteNameConfirm(e.target.value)}
          placeholder="First name"
          disabled={deleteBusy}
          autoComplete="off"
        />
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px]"
            disabled={deleteBusy}
            onClick={() => {
              setDeleteModalOpen(false)
              setDeleteAckIrreversible(false)
              setDeleteNameConfirm('')
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            className="min-h-[44px]"
            disabled={
              deleteBusy ||
              !deleteAckIrreversible ||
              deleteNameConfirm.trim().toLowerCase() !== (client.first_name ?? '').trim().toLowerCase()
            }
            onClick={async () => {
              setDeleteBusy(true)
              try {
                const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' })
                const json = (await res.json().catch(() => ({}))) as { error?: string }
                if (!res.ok) {
                  setToast(json.error ?? 'Could not delete client')
                  setDeleteBusy(false)
                  return
                }
                setDeleteModalOpen(false)
                setDeleteAckIrreversible(false)
                setDeleteNameConfirm('')
                try {
                  sessionStorage.setItem('clearpath_clients_toast', 'Client deleted')
                } catch {
                  /* ignore */
                }
                router.push('/coach/clients')
              } catch {
                setToast('Something went wrong — try again')
                setDeleteBusy(false)
              }
            }}
          >
            {deleteBusy ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </div>
      </Modal>

      <AssignProgramToClientModal
        clientId={clientId}
        clientName={fullName}
        open={assignProgramOpen}
        onClose={() => setAssignProgramOpen(false)}
        onAssigned={() => {
          fetch(`/api/clients/${clientId}/programs`)
            .then((r) => r.json())
            .then((json) => json.data && setClientPrograms(json.data))
        }}
      />

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        defaultClientId={clientId}
        onRecorded={() => loadPaymentsTab()}
      />

      <QuickInvoiceModal
        open={quickInvoiceOpen}
        onClose={() => setQuickInvoiceOpen(false)}
        defaultClientId={clientId}
        onSent={(name) => {
          setToast(`Invoice sent to ${name}`)
        }}
      />
    </div>
  )
}
