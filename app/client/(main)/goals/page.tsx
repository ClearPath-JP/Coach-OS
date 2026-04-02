'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow, isBefore, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { CoachGoalDto } from '@/components/coach/ClientGoalsTab'

const CATEGORY_CLASS: Record<string, string> = {
  fitness: 'border-sky-200 bg-sky-50 text-sky-900',
  nutrition: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  mindset: 'border-violet-200 bg-violet-50 text-violet-900',
  business: 'border-green-200 bg-green-50 text-green-900',
  relationship: 'border-rose-200 bg-rose-50 text-rose-900',
  health: 'border-teal-200 bg-teal-50 text-teal-900',
  performance: 'border-amber-200 bg-amber-50 text-amber-900',
  general: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]',
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
      <main className="mx-auto max-w-[720px] px-4 py-8">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--border-default)]/50" />
          ))}
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-8">
        <Card padding="lg" className="text-center">
          <p className="text-[var(--text-secondary)]">{error}</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">My goals</h1>
        <Link href="/client/portal" className="link-nav text-[14px] font-medium">
          Back to home
        </Link>
      </div>

      {goals.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-2xl" aria-hidden>
            🎯
          </p>
          <p className="mt-2 text-[var(--text-15)] font-semibold text-[var(--text-primary)]">No goals yet</p>
          <p className="mt-2 text-[var(--text-14)] text-[var(--text-tertiary)]">
            When your coach sets goals, you&apos;ll see progress here.
          </p>
        </Card>
      ) : (
        <ul className="space-y-6">
          {goals.map((g) => {
            const catClass = CATEGORY_CLASS[g.category] ?? CATEGORY_CLASS.general
            const showBar = g.targetValue != null && g.startValue != null
            const overdue =
              g.status === 'active' &&
              g.targetDate &&
              isBefore(startOfDay(parseISO(g.targetDate)), startOfDay(new Date()))

            return (
              <li key={g.id}>
                <Card
                  padding="lg"
                  className={
                    g.status === 'achieved'
                      ? 'border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                      : ''
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${catClass}`}
                    >
                      {g.category}
                    </span>
                    {g.status === 'achieved' ? (
                      <span className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-200">
                        Achieved! 🏆
                      </span>
                    ) : (
                      <Badge variant="active">Active</Badge>
                    )}
                  </div>
                  <h2 className="mt-3 text-[18px] font-semibold text-[var(--text-primary)]">{g.title}</h2>
                  {g.description ? (
                    <p className="mt-2 text-[14px] text-[var(--text-tertiary)]">{g.description}</p>
                  ) : null}

                  {showBar ? (
                    <div className="mt-4">
                      <p className="text-[13px] text-[var(--text-tertiary)]">
                        {formatValue(g.startValue, g.unit)} → {formatValue(g.currentValue, g.unit)} →{' '}
                        {formatValue(g.targetValue, g.unit)}
                      </p>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] transition-all duration-700"
                          style={{ width: `${g.progressPercent ?? 0}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[14px] font-medium text-[var(--accent)]">
                        {g.progressPercent != null ? `${g.progressPercent}% complete` : '—'}
                      </p>
                    </div>
                  ) : null}

                  {g.targetDate ? (
                    <p
                      className={`mt-2 text-[13px] ${overdue ? 'font-medium text-red-600' : 'text-[var(--text-tertiary)]'}`}
                    >
                      Target: {format(parseISO(g.targetDate), 'MMMM d, yyyy')}
                    </p>
                  ) : null}

                  {g.updates && g.updates.length > 0 ? (
                    <div className="mt-6 border-t border-[var(--border-default)] pt-4">
                      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        History
                      </h3>
                      <ul className="mt-3 space-y-3">
                        {g.updates.map((u) => (
                          <li
                            key={u.id}
                            className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[13px]"
                          >
                            <p className="tabular-nums text-[var(--text-primary)]">
                              {u.previousValue != null ? `${u.previousValue} → ` : ''}
                              {u.newValue}
                            </p>
                            {u.note ? (
                              <p className="mt-1 text-[var(--text-tertiary)] whitespace-pre-wrap">{u.note}</p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">
                              {formatDistanceToNow(parseISO(u.createdAt), { addSuffix: true })}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
