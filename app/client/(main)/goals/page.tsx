'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format, isBefore, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { CoachGoalDto } from '@/components/coach/ClientGoalsTab'
import { cn } from '@/lib/utils'
import { AnimatedBar } from '@/components/client/AnimatedBar'

const CATEGORY_CLASS: Record<string, string> = {
  fitness: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]',
  nutrition: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  mindset: 'border-[var(--accent-muted)] bg-[var(--accent-light)] text-[var(--cp-accent)]',
  business: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
  relationship: 'border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error)]',
  health: 'border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error)]',
  performance: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]',
  general: 'border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-secondary)]',
}

function formatValue(n: number | null | undefined, unit: string | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const u = unit?.trim()
  return u ? `${n} ${u}` : String(n)
}

export default function ClientGoalsPage() {
  const [goals, setGoals] = useState<CoachGoalDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/client/goals', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load goals')
        setGoals([])
        return
      }
      setGoals(Array.isArray(json.data) ? json.data : [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setGoals([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <main className="client-page-content mx-auto max-w-[720px] px-4 py-8 md:px-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--bg-muted)]" />
          ))}
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="client-page-content mx-auto max-w-[720px] px-4 py-8 md:px-6">
        <Card padding="lg" className="text-center">
          <p className="text-[var(--text-secondary)]">{error}</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </Card>
      </main>
    )
  }

  const activeList = goals.filter((g) => g.status === 'active' || g.status === 'paused')
  const achievedList = goals.filter((g) => g.status === 'achieved')

  return (
    <main className="client-page-content mx-auto max-w-[720px] px-4 py-8 md:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">My Goals</h1>

      {goals.length === 0 ? (
        <EmptyState
          title="No goals set yet"
          description="Your coach will set goals here to track your progress together."
        />
      ) : (
        <ul className="mt-8 space-y-6">
          {activeList.map((g) => (
            <GoalCard
              key={g.id}
              g={g}
              expanded={expandedId === g.id}
              onToggleHistory={() => setExpandedId((id) => (id === g.id ? null : g.id))}
            />
          ))}
          {achievedList.length > 0 ? (
            <>
              <li className="pt-4">
                <h2 className="font-[family-name:var(--font-display)] text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Achieved
                </h2>
              </li>
              {achievedList.map((g) => (
                <GoalCard
                  key={g.id}
                  g={g}
                  expanded={expandedId === g.id}
                  onToggleHistory={() => setExpandedId((id) => (id === g.id ? null : g.id))}
                />
              ))}
            </>
          ) : null}
        </ul>
      )}

      <div className="mt-8">
        <Link href="/client/portal" className="text-[14px] font-medium text-[var(--cp-accent)]">
          ← Back to home
        </Link>
      </div>
    </main>
  )
}

function GoalCard({
  g,
  expanded,
  onToggleHistory,
}: {
  g: CoachGoalDto
  expanded: boolean
  onToggleHistory: () => void
}) {
  const catClass = CATEGORY_CLASS[g.category] ?? CATEGORY_CLASS.general
  const showBar = g.targetValue != null && g.startValue != null
  const overdue =
    g.status === 'active' && g.targetDate && isBefore(startOfDay(parseISO(g.targetDate)), startOfDay(new Date()))
  const updates = g.updates ?? []
  const nUpdates = updates.length

  return (
    <li>
      <div className={cn(
        'rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] p-6 shadow-[5px_5px_0_var(--ink)]',
        g.status === 'achieved' && 'bg-[var(--success-bg)]'
      )}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize', catClass)}>
            {g.category}
          </span>
          {g.status === 'achieved' ? (
            <span className="arcade-badge arcade-badge-teal">🏆 Achieved</span>
          ) : g.status === 'paused' ? (
            <span className="arcade-badge">Paused</span>
          ) : (
            <span className="arcade-badge arcade-badge-blue">Active</span>
          )}
        </div>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{g.title}</h2>
        {g.description ? <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{g.description}</p> : null}

        {showBar ? (
          <div className="mt-4">
            <div className="flex items-center justify-between font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-secondary)]">
              <span>
                {formatValue(g.startValue, g.unit)} → {formatValue(g.currentValue, g.unit)} → {formatValue(g.targetValue, g.unit)}
              </span>
              <span>{g.progressPercent != null ? `${g.progressPercent}%` : '—'}</span>
            </div>
            <div className="arcade-track mt-2 h-2.5">
              <AnimatedBar
                percent={g.progressPercent ?? 0}
                className="h-full w-full"
                fillClassName={g.status === 'achieved' ? 'bg-[var(--belt-teal)]' : 'bg-[var(--cp-accent)]'}
              />
            </div>
          </div>
        ) : null}

        {g.status === 'achieved' && g.achievedAt ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--success)]">
            Achieved on {format(parseISO(g.achievedAt), 'MMMM d, yyyy')}
          </p>
        ) : null}

        {g.targetDate ? (
          <p className={cn('mt-1 text-[12px]', overdue ? 'font-medium text-[var(--error)]' : 'text-[var(--text-tertiary)]')}>
            Target: {format(parseISO(g.targetDate), 'MMMM d, yyyy')}
          </p>
        ) : null}

        {nUpdates > 0 ? (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              onClick={onToggleHistory}
              className="flex w-full items-center justify-between text-left text-[13px] font-medium text-[var(--cp-accent)]"
            >
              Show history ({nUpdates} updates)
              <span className="text-[var(--text-tertiary)]" aria-hidden>
                {expanded ? '▾' : '▸'}
              </span>
            </button>
            {expanded ? (
              <ul className="mt-3 space-y-3 border-l border-[var(--border-subtle)] pl-3">
                {updates.map((u) => (
                  <li key={u.id} className="relative text-[13px]">
                    <span className="absolute -left-[17px] top-1.5 size-2 rounded-full bg-[var(--border-strong)]" aria-hidden />
                    <p className="text-[11px] text-[var(--text-quaternary)]">
                      {format(parseISO(u.createdAt), 'MMM d, yyyy')}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      {u.previousValue != null ? `${u.previousValue} → ` : ''}
                      {u.newValue}
                      {g.unit ? ` ${g.unit}` : ''}
                    </p>
                    {u.note ? <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{u.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
