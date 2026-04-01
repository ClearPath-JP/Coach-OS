'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AssignmentReviewModal } from '@/components/coach/AssignmentReviewModal'
import { AssignmentSubmitModal } from '@/components/client/AssignmentSubmitModal'

type AssignmentMsg = {
  type: 'assignment'
  clientAssignmentId: string
  templateTitle?: string
  assignmentType?: string
  instructions?: string | null
  checklistItems?: string[] | null
  dueAt?: string | null
  points?: number
  status?: string
}

type FeedbackMsg = {
  type: 'assignment_feedback'
  clientAssignmentId?: string
  templateTitle?: string
  status?: string
  pointsAwarded?: number
  streakBonus?: number
  coachFeedback?: string | null
  newLevel?: number
  levelName?: string
  leveledUp?: boolean
  totalXp?: number
}

function typeBadge(t: string | undefined) {
  const m: Record<string, string> = {
    text: 'Text',
    video: 'Video',
    file: 'File',
    checklist: 'Checklist',
  }
  return m[t ?? ''] ?? 'Assignment'
}

function statusBadge(status: string | undefined) {
  const s = status ?? 'pending'
  const variant =
    s === 'approved' ? 'active' : s === 'submitted' ? 'pending' : s === 'returned' ? 'pending' : 'inactive'
  return <Badge variant={variant}>{s}</Badge>
}

export function CoachAssignmentChatCard({
  content,
  createdAt,
  userId,
  senderId,
  selectedClientId,
  selectedClientName,
  fetchMessages,
}: {
  content: string
  createdAt: string
  userId: string | null
  senderId: string
  selectedClientId: string
  selectedClientName: string
  fetchMessages: (clientId: string) => void | Promise<void>
}) {
  const data = useMemo((): AssignmentMsg | null => {
    try {
      const p = JSON.parse(content) as AssignmentMsg
      if (p?.type === 'assignment' && p.clientAssignmentId) return p
      return null
    } catch {
      return null
    }
  }, [content])
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pointsDefault, setPointsDefault] = useState(10)

  useEffect(() => {
    if (!data?.clientAssignmentId) return
    void (async () => {
      const res = await fetch(`/api/assignments/${data.clientAssignmentId}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setLiveStatus(json.data.status)
        const tpl = json.data.assignment_templates as { points?: number } | null
        if (tpl?.points != null) setPointsDefault(tpl.points)
      }
    })()
  }, [data?.clientAssignmentId])

  if (!data) return null

  const status = liveStatus ?? data.status ?? 'pending'
  const isMine = senderId === userId
  const dueLabel = data.dueAt
    ? formatDistanceToNow(new Date(data.dueAt), { addSuffix: true })
    : null

  return (
    <div className="max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-start gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-lg" aria-hidden>
          📋
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-ink)]">{data.templateTitle ?? 'Assignment'}</p>
          {data.instructions ? (
            <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-3">{data.instructions}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="pending">{typeBadge(data.assignmentType)}</Badge>
            {data.points != null ? <Badge variant="active">{data.points} XP</Badge> : null}
            {statusBadge(status)}
          </div>
          {dueLabel ? <p className="mt-2 text-xs text-[var(--color-muted)]">Due {dueLabel}</p> : null}
          {isMine && status === 'submitted' ? (
            <Button type="button" className="mt-3 w-full" onClick={() => setReviewOpen(true)}>
              Review
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-[var(--color-muted)]">{new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>

      <AssignmentReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        clientAssignmentId={data.clientAssignmentId}
        clientName={selectedClientName}
        defaultPoints={pointsDefault}
        onReviewed={() => void fetchMessages(selectedClientId)}
      />
    </div>
  )
}

export function CoachAssignmentFeedbackCard({
  content,
  createdAt,
  sentByCoach,
}: {
  content: string
  createdAt: string
  sentByCoach: boolean
}) {
  let data: FeedbackMsg | null = null
  try {
    const p = JSON.parse(content) as FeedbackMsg
    if (p?.type === 'assignment_feedback') data = p
  } catch {
    data = null
  }
  if (!data) return null

  if (sentByCoach) {
    return (
      <div className="max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-accent)]/10 p-3">
        <p className="text-sm font-medium text-[var(--color-ink)]">Feedback sent to client</p>
        {data.status === 'approved' ? (
          <p className="mt-1 text-xs text-[var(--color-muted)]">+{data.pointsAwarded ?? 0} XP awarded</p>
        ) : (
          <p className="mt-1 text-xs text-[var(--color-muted)]">Returned for revision</p>
        )}
        <p className="mt-2 text-[12px] text-[var(--color-muted)]">
          {new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-sm font-medium text-[var(--color-ink)]">Coach reviewed your work</p>
      {data.status === 'approved' && (data.pointsAwarded ?? 0) > 0 ? (
        <p className="mt-2 text-lg font-semibold text-emerald-700">+{data.pointsAwarded} XP</p>
      ) : null}
      {data.streakBonus ? <p className="text-xs text-[var(--color-muted)]">Streak bonus +{data.streakBonus} XP</p> : null}
      {data.coachFeedback ? <p className="mt-2 text-sm text-[var(--color-ink)] whitespace-pre-wrap">{data.coachFeedback}</p> : null}
      {data.leveledUp && data.levelName ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          You reached Level {data.newLevel}: {data.levelName}!
        </p>
      ) : null}
      <p className="mt-2 text-[12px] text-[var(--color-muted)]">{new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
    </div>
  )
}

export function ClientAssignmentChatCard({
  content,
  createdAt,
  userId,
  senderId,
  fetchMessages,
}: {
  content: string
  createdAt: string
  userId: string | null
  senderId: string
  fetchMessages: () => void | Promise<void>
}) {
  const data = useMemo((): AssignmentMsg | null => {
    try {
      const p = JSON.parse(content) as AssignmentMsg
      if (p?.type === 'assignment' && p.clientAssignmentId) return p
      return null
    } catch {
      return null
    }
  }, [content])
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [tpl, setTpl] = useState<{
    title: string
    instructions: string | null
    assignment_type: string
    checklist_items: string[] | null
  } | null>(null)

  useEffect(() => {
    if (!data?.clientAssignmentId) return
    void (async () => {
      const res = await fetch(`/api/client/assignments/${data.clientAssignmentId}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setLiveStatus(json.data.status)
        const t = json.data.assignment_templates as {
          title?: string
          instructions?: string | null
          assignment_type?: string
          checklist_items?: unknown
        } | null
        if (t) {
          const items = Array.isArray(t.checklist_items) ? (t.checklist_items as string[]) : null
          setTpl({
            title: t.title ?? 'Assignment',
            instructions: t.instructions ?? null,
            assignment_type: (t.assignment_type as 'text') ?? 'text',
            checklist_items: items,
          })
        }
      }
    })()
  }, [data?.clientAssignmentId])

  if (!data) return null

  const status = liveStatus ?? data.status ?? 'pending'
  const fromCoach = senderId !== userId
  const dueLabel = data.dueAt
    ? formatDistanceToNow(new Date(data.dueAt), { addSuffix: true })
    : null

  const checklistItemsResolved = tpl?.checklist_items ?? data.checklistItems ?? null

  return (
    <div className="max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-start gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-lg" aria-hidden>
          📋
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-ink)]">{tpl?.title ?? data.templateTitle ?? 'Assignment'}</p>
          {(tpl?.instructions ?? data.instructions) ? (
            <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-4">{tpl?.instructions ?? data.instructions}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="pending">{typeBadge(tpl?.assignment_type ?? data.assignmentType)}</Badge>
            {data.points != null ? <Badge variant="active">{data.points} XP</Badge> : null}
            {statusBadge(status)}
          </div>
          {dueLabel ? <p className="mt-2 text-xs text-[var(--color-muted)]">Due {dueLabel}</p> : null}

          {fromCoach && status === 'pending' ? (
            <Button type="button" className="mt-3 w-full" onClick={() => setSubmitOpen(true)}>
              Submit assignment
            </Button>
          ) : null}
          {fromCoach && status === 'submitted' ? (
            <p className="mt-3 text-sm font-medium text-emerald-700">Submitted ✓</p>
          ) : null}
          {fromCoach && status === 'approved' ? (
            <p className="mt-3 rounded-lg bg-emerald-50 px-2 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40">
              Approved! +{data.points ?? 0} XP earned
            </p>
          ) : null}
          {fromCoach && status === 'returned' ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p>Your coach wants you to revise this.</p>
              <Button type="button" variant="secondary" className="mt-2 w-full" onClick={() => setSubmitOpen(true)}>
                Resubmit
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-[var(--color-muted)]">{new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>

      {tpl ? (
        <AssignmentSubmitModal
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          clientAssignmentId={data.clientAssignmentId}
          title={tpl.title}
          instructions={tpl.instructions}
          assignmentType={tpl.assignment_type as 'text' | 'video' | 'file' | 'checklist'}
          checklistItems={checklistItemsResolved}
          onSubmitted={() => void fetchMessages()}
        />
      ) : null}
    </div>
  )
}

export function ClientAssignmentFeedbackCard({ content, createdAt }: { content: string; createdAt: string }) {
  let data: FeedbackMsg | null = null
  try {
    const p = JSON.parse(content) as FeedbackMsg
    if (p?.type === 'assignment_feedback') data = p
  } catch {
    data = null
  }
  if (!data) return null

  return (
    <div className="max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-sm font-medium text-[var(--color-ink)]">Coach reviewed your work</p>
      {data.status === 'approved' && (data.pointsAwarded ?? 0) > 0 ? (
        <p className="mt-2 text-lg font-semibold text-emerald-700">+{data.pointsAwarded} XP</p>
      ) : null}
      {data.coachFeedback ? <p className="mt-2 text-sm whitespace-pre-wrap text-[var(--color-ink)]">{data.coachFeedback}</p> : null}
      {data.leveledUp && data.levelName ? (
        <p className="mt-2 text-sm font-medium text-emerald-700">
          You reached Level {data.newLevel}: {data.levelName}!
        </p>
      ) : null}
      <p className="mt-2 text-[12px] text-[var(--color-muted)]">{new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
    </div>
  )
}
