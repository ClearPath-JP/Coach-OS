'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
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
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">
          Assignments
        </h1>
        {pendingCount > 0 ? (
          <span className="arcade-badge arcade-badge-coral">{pendingCount} due</span>
        ) : null}
      </div>

      {loading || !rewards ? (
        <div className="h-32 animate-pulse rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--bg-subtle)]" />
      ) : (
        <div className="rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] p-5 shadow-[5px_5px_0_var(--ink)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="arcade-medal bg-[var(--belt-yellow)] font-[family-name:var(--font-display)] text-lg font-extrabold text-[var(--ink)]">
                {rewards.level}
              </div>
              <p className="mt-1.5 text-center text-xs font-bold text-[var(--text-secondary)]">{rewards.levelName}</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                <span>XP progress</span>
                {rewards.currentStreakDays > 0 ? (
                  <span className="arcade-streak">🔥 {rewards.currentStreakDays}-day streak</span>
                ) : null}
              </div>
              <div className="arcade-track mt-2 h-3">
                <div
                  className="arcade-fill arcade-fill-yellow transition-[width] duration-[800ms] ease-out"
                  style={{ width: `${xpBarPct}%` }}
                />
              </div>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-xs font-bold text-[var(--text-secondary)]">
                {rewards.totalXp} XP · {rewards.xpToNextLevel} to next level · {rewards.assignmentsCompleted} done
              </p>
            </div>
          </div>
          <Link href="/client/portal" className="mt-3 inline-block text-sm font-bold text-[var(--cp-accent)]">
            Back to portal
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'completed'] as const).map((f) => {
          const count = f === 'all' ? rows.length : f === 'pending' ? pendingCount : rows.filter((r) => r.status === 'approved').length
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border-2 border-[var(--ink)] px-3 py-1.5 font-[family-name:var(--font-display)] text-sm font-bold transition-all',
                filter === f
                  ? 'bg-[var(--belt-yellow)] text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
              )}
            >
              {f === 'all' ? `All ${count}` : f === 'pending' ? `Due Soon ${count}` : `Completed ${count}`}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        {!loading && rows.length === 0 ? (
          <EmptyState
            title="You're all caught up!"
            description="Your coach will send assignments here. Check back soon."
          />
        ) : null}
        {filtered.map((r) => {
          const t = r.assignment_templates
          const overdue = r.due_at && new Date(r.due_at) < new Date() && (r.status === 'pending' || r.status === 'returned')
          return (
            <div key={r.id} className="rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] p-4 shadow-[5px_5px_0_var(--ink)]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[20px]" aria-hidden>
                  {t?.assignment_type === 'video' ? '🎥' : t?.assignment_type === 'checklist' ? '✅' : '📝'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-[family-name:var(--font-display)] font-extrabold tracking-[-0.01em] text-[var(--text-primary)]">{t?.title ?? 'Assignment'}</p>
                    {t?.points ? (
                      <span className="arcade-badge arcade-badge-yellow shrink-0">
                        +{r.status === 'approved' ? r.points_awarded || t.points : t.points} XP
                      </span>
                    ) : null}
                  </div>
                  <p className={cn('text-xs', overdue ? 'font-bold text-[var(--error)]' : 'text-[var(--text-tertiary)]')}>
                    {r.due_at
                      ? overdue
                        ? `Overdue ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                        : `Due ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                      : 'No due date'}
                  </p>
                </div>
              </div>
              {t?.instructions ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-3">{t.instructions}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(r.status === 'pending' || r.status === 'returned') && t ? (
                  <Button type="button" size="sm" onClick={() => setSubmitFor(r)}>
                    {r.status === 'returned' ? 'Resubmit' : t.assignment_type === 'video' ? 'Upload Video' : 'Mark Complete'}
                  </Button>
                ) : null}
                {r.status === 'approved' ? (
                  <span className="arcade-badge arcade-badge-teal">
                    Earned +{r.points_awarded || t?.points || 0} XP
                  </span>
                ) : null}
                {r.coach_feedback && (r.status === 'returned' || r.status === 'approved') ? (
                  <p className="w-full rounded-[12px] border-2 border-[var(--ink)] bg-[var(--cp-offwhite)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--text-primary)]">Coach:</span> {r.coach_feedback}
                  </p>
                ) : null}
              </div>
            </div>
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
