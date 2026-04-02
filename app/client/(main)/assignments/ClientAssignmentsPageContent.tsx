'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { AssignmentSubmitModal } from '@/components/client/AssignmentSubmitModal'
import { getProgressPercent } from '@/lib/xp-system'
import { cn } from '@/lib/utils'

type AssignmentRow = {
  id: string
  status: string
  due_at: string | null
  coach_feedback: string | null
  points_awarded: number
  assignment_templates: {
    title: string
    instructions: string | null
    assignment_type: string
    points: number
    checklist_items: unknown
  } | null
}

export function ClientAssignmentsPageContent() {
  const [rewards, setRewards] = useState<{
    totalXp: number
    level: number
    levelName: string
    currentStreakDays: number
    assignmentsCompleted: number
    xpToNextLevel: number
    progressPercent: number
  } | null>(null)
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [submitFor, setSubmitFor] = useState<AssignmentRow | null>(null)
  const [xpBarPct, setXpBarPct] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, aRes] = await Promise.all([fetch('/api/client/rewards'), fetch('/api/client/assignments')])
      const [rJ, aJ] = await Promise.all([rRes.json(), aRes.json()])
      if (rRes.ok && rJ.data) {
        const d = rJ.data
        setRewards({
          totalXp: d.totalXp,
          level: d.level,
          levelName: d.levelName,
          currentStreakDays: d.currentStreakDays,
          assignmentsCompleted: d.assignmentsCompleted,
          xpToNextLevel: d.xpToNextLevel ?? 0,
          progressPercent: d.progressPercent ?? getProgressPercent(d.totalXp),
        })
      }
      if (aRes.ok) setRows(aJ.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!rewards) return
    const t = window.setTimeout(() => setXpBarPct(rewards.progressPercent), 50)
    return () => window.clearTimeout(t)
  }, [rewards])

  const filtered = useMemo(() => {
    if (filter === 'pending') return rows.filter((r) => r.status === 'pending' || r.status === 'returned')
    if (filter === 'completed') return rows.filter((r) => r.status === 'approved')
    return rows
  }, [rows, filter])

  const pendingCount = rows.filter((r) => r.status === 'pending' || r.status === 'returned').length

  const tplForSubmit = submitFor?.assignment_templates

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-[var(--text-24)]">
          Assignments
        </h1>
        {pendingCount > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            {pendingCount} due
          </span>
        ) : null}
      </div>

      {loading || !rewards ? (
        <div className="h-32 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
      ) : (
        <Card
          className={cn(
            'overflow-hidden border-[var(--border-default)] bg-[linear-gradient(135deg,var(--accent-light),transparent)] p-5'
          )}
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-semibold text-white">
                {rewards.level}
              </div>
              <p className="mt-1 text-center text-xs text-[var(--text-secondary)]">{rewards.levelName}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">XP progress</p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-[800ms] ease-out"
                  style={{ width: `${xpBarPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {rewards.totalXp} XP · {rewards.xpToNextLevel} to next level
              </p>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              <p>Streak {rewards.currentStreakDays}d</p>
              <p>Done {rewards.assignmentsCompleted}</p>
            </div>
          </div>
          <Link href="/client/portal" className="mt-3 inline-block text-sm font-medium text-[var(--accent)]">
            Back to portal
          </Link>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'completed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              filter === f ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
            )}
          >
            {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Completed'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {!loading && rows.length === 0 ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] px-6 py-12 text-center">
            <p className="text-3xl" aria-hidden>
              ✨
            </p>
            <h2 className="mt-3 text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              You&apos;re all caught up!
            </h2>
            <p className="mx-auto mt-2 max-w-[400px] text-[var(--text-14)] font-normal leading-[1.6] text-[var(--text-tertiary)]">
              Your coach will send assignments here. Check back soon.
            </p>
          </div>
        ) : null}
        {filtered.map((r) => {
          const t = r.assignment_templates
          const overdue = r.due_at && new Date(r.due_at) < new Date() && (r.status === 'pending' || r.status === 'returned')
          return (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{t?.title ?? 'Assignment'}</p>
                  <p className={cn('text-xs', overdue ? 'text-red-600' : 'text-[var(--text-tertiary)]')}>
                    {r.due_at
                      ? overdue
                        ? `Overdue ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                        : `Due ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                      : null}
                  </p>
                </div>
                <Badge variant="pending">{t?.assignment_type}</Badge>
              </div>
              {t?.instructions ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-3">{t.instructions}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {(r.status === 'pending' || r.status === 'returned') && t ? (
                  <Button type="button" size="sm" onClick={() => setSubmitFor(r)}>
                    {r.status === 'returned' ? 'Resubmit' : 'Submit'}
                  </Button>
                ) : null}
                {r.status === 'approved' ? (
                  <span className="text-sm text-emerald-700">+{r.points_awarded || t?.points || 0} XP</span>
                ) : null}
                {r.coach_feedback && (r.status === 'returned' || r.status === 'approved') ? (
                  <p className="w-full text-sm text-[var(--text-secondary)]">Coach: {r.coach_feedback}</p>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>

      {tplForSubmit && submitFor ? (
        <AssignmentSubmitModal
          open
          onClose={() => setSubmitFor(null)}
          clientAssignmentId={submitFor.id}
          title={tplForSubmit.title}
          instructions={tplForSubmit.instructions}
          assignmentType={tplForSubmit.assignment_type as 'text' | 'video' | 'file' | 'checklist'}
          checklistItems={
            Array.isArray(tplForSubmit.checklist_items)
              ? (tplForSubmit.checklist_items as string[])
              : null
          }
          onSubmitted={() => {
            setSubmitFor(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
