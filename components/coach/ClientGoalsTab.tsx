'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, formatDistanceToNow, isBefore, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
type GoalUpdate = {
  id: string
  previousValue: number | null
  newValue: number
  note: string | null
  createdAt: string
  recordedBy: string
}

export type CoachGoalDto = {
  id: string
  title: string
  description: string | null
  category: string
  targetValue: number | null
  currentValue: number | null
  unit: string | null
  startValue: number | null
  targetDate: string | null
  status: string
  achievedAt: string | null
  createdAt: string
  updatedAt: string
  progressPercent: number | null
  latestUpdate: GoalUpdate | null
  updates?: GoalUpdate[]
}

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

const GOAL_CATEGORIES = [
  'fitness',
  'nutrition',
  'mindset',
  'business',
  'relationship',
  'health',
  'performance',
  'general',
] as const

function formatValue(n: number | null | undefined, unit: string | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const u = unit?.trim()
  return u ? `${n} ${u}` : String(n)
}

const confettiColors = [
  '#3b9ee8',
  '#16a34a',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#6366f1',
  '#84cc16',
]

export function ClientGoalsTab({
  clientId,
  clientFirstName,
  fullName,
}: {
  clientId: string
  clientFirstName: string
  fullName: string
}) {
  const [goals, setGoals] = useState<CoachGoalDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [measurable, setMeasurable] = useState(true)
  const [addTitle, setAddTitle] = useState('')
  const [addCategory, setAddCategory] = useState<string>('general')
  const [addDescription, setAddDescription] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addTarget, setAddTarget] = useState('')
  const [addUnit, setAddUnit] = useState('')
  const [addTargetDate, setAddTargetDate] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [celebrateGoal, setCelebrateGoal] = useState<CoachGoalDto | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [editGoal, setEditGoal] = useState<CoachGoalDto | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [updateGoalId, setUpdateGoalId] = useState<string | null>(null)
  const [updateValue, setUpdateValue] = useState('')
  const [updateNote, setUpdateNote] = useState('')
  const [updateSaving, setUpdateSaving] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/goals?clientId=${encodeURIComponent(clientId)}&includeUpdates=1`,
        { credentials: 'include' }
      )
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
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const openAdd = () => {
    setAddTitle('')
    setAddCategory('general')
    setAddDescription('')
    setMeasurable(true)
    setAddStart('')
    setAddTarget('')
    setAddUnit('')
    setAddTargetDate('')
    setAddOpen(true)
  }

  const submitAdd = async () => {
    if (!addTitle.trim() || addSaving) return
    setAddSaving(true)
    try {
      const body: Record<string, unknown> = {
        clientId,
        title: addTitle.trim(),
        category: addCategory,
        description: addDescription.trim() || null,
      }
      if (measurable) {
        if (addStart.trim()) body.startValue = parseFloat(addStart)
        if (addTarget.trim()) body.targetValue = parseFloat(addTarget)
        body.unit = addUnit.trim() || null
      } else {
        body.targetValue = null
        body.startValue = null
        body.unit = null
      }
      if (addTargetDate.trim()) body.targetDate = addTargetDate.trim()
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setToast(json.error ?? 'Could not create goal')
        return
      }
      setAddOpen(false)
      setToast('Goal created')
      await load()
    } catch {
      setToast('Something went wrong — try again')
    } finally {
      setAddSaving(false)
    }
  }

  const patchGoal = async (id: string, patch: Record<string, unknown>, successMsg: string) => {
    const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) {
      setToast(json.error ?? 'Could not update goal')
      return null
    }
    setToast(successMsg)
    await load()
    return json.data as CoachGoalDto
  }

  const shareAchievement = async (g: CoachGoalDto) => {
    const text = `🏆 You achieved your goal: ${g.title}!\nAmazing work. Let's set the next one.`
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ clientId, content: text }),
    })
    const json = await res.json()
    if (!res.ok) {
      setToast(json.error ?? 'Could not send message')
      return
    }
    setToast('Shared with client in messages')
    setCelebrateGoal(null)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--color-border)]/40" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card variant="raised" padding="lg" className="text-center">
        <p className="text-[var(--color-muted)]">{error}</p>
        <Button type="button" variant="secondary" className="mt-4 min-h-[44px]" onClick={() => void load()}>
          Try again
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {showConfetti
        ? confettiColors.map((bg, i) => (
            <div
              key={i}
              className="confetti-piece pointer-events-none fixed inset-x-0 top-0 z-[100]"
              style={{
                left: `${10 + i * 8}%`,
                backgroundColor: bg,
                animationDelay: `${i * 0.1}s`,
              }}
              aria-hidden
            />
          ))
        : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">Goals</h2>
        <Button type="button" className="min-h-[44px]" onClick={openAdd}>
          Add goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card variant="raised" padding="lg" className="text-center">
          <p className="text-2xl" aria-hidden>
            🎯
          </p>
          <p className="mt-2 text-[16px] font-semibold text-[var(--color-ink)]">No goals set yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--color-muted)]">
            Set measurable goals with your client to track progress and prove results.
          </p>
          <Button type="button" className="mt-6 min-h-[44px]" onClick={openAdd}>
            Add first goal
          </Button>
        </Card>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => {
            const catClass = CATEGORY_CLASS[g.category] ?? CATEGORY_CLASS.general
            const overdue =
              g.status === 'active' &&
              g.targetDate &&
              isBefore(startOfDay(parseISO(g.targetDate)), startOfDay(new Date()))
            const showBar = g.targetValue != null && g.startValue != null
            return (
              <li key={g.id}>
                <Card variant="raised" padding="lg" className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${catClass}`}
                      >
                        {g.category}
                      </span>
                      {g.status === 'active' ? (
                        <Badge variant="active">Active</Badge>
                      ) : g.status === 'achieved' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900">
                          🏆 Achieved
                        </span>
                      ) : g.status === 'paused' ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
                          Paused
                        </span>
                      ) : (
                        <Badge variant="inactive">Abandoned</Badge>
                      )}
                    </div>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 min-w-9 px-2"
                        aria-label="Goal actions"
                        onClick={() => setMenuOpenId((id) => (id === g.id ? null : g.id))}
                      >
                        …
                      </Button>
                      {menuOpenId === g.id ? (
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[var(--color-surface)]"
                            onClick={() => {
                              setMenuOpenId(null)
                              setEditGoal(g)
                              setEditTitle(g.title)
                              setEditDate(g.targetDate ?? '')
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[var(--color-surface)]"
                            onClick={async () => {
                              setMenuOpenId(null)
                              const updated = await patchGoal(g.id, { status: 'achieved' }, 'Marked as achieved')
                              if (updated?.status === 'achieved') {
                                setCelebrateGoal(updated)
                                setShowConfetti(true)
                                window.setTimeout(() => setShowConfetti(false), 3200)
                              }
                            }}
                          >
                            Achieve
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[var(--color-surface)]"
                            onClick={() => {
                              setMenuOpenId(null)
                              void patchGoal(g.id, { status: 'paused' }, 'Goal paused')
                            }}
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[14px] text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              setMenuOpenId(null)
                              if (!window.confirm(`Delete goal “${g.title}”?`)) return
                              const res = await fetch(`/api/goals/${encodeURIComponent(g.id)}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              })
                              const json = await res.json()
                              if (!res.ok) {
                                setToast(json.error ?? 'Could not delete')
                                return
                              }
                              setToast('Goal deleted')
                              await load()
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <h3 className="mt-3 text-[16px] font-semibold text-[var(--color-ink)]">{g.title}</h3>
                  {g.description ? (
                    <p className="mt-1 text-[13px] text-[var(--color-muted)]">{g.description}</p>
                  ) : null}

                  {showBar ? (
                    <div className="mt-4">
                      <p className="text-[13px] text-[var(--color-muted)]">
                        {formatValue(g.startValue, g.unit)} → {formatValue(g.currentValue, g.unit)} →{' '}
                        {formatValue(g.targetValue, g.unit)}
                      </p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                          style={{ width: `${g.progressPercent ?? 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[13px] font-medium text-[var(--color-accent)]">
                        {g.progressPercent != null ? `${g.progressPercent}% there` : '—'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 text-[13px] text-[var(--color-muted)]">
                      {g.latestUpdate?.note ? (
                        <p className="whitespace-pre-wrap">Latest note: {g.latestUpdate.note}</p>
                      ) : (
                        <p>Qualitative goal — use updates to track notes.</p>
                      )}
                    </div>
                  )}

                  {g.targetDate ? (
                    <p
                      className={`mt-2 text-[13px] ${overdue ? 'font-medium text-red-600' : 'text-[var(--color-muted)]'}`}
                    >
                      Target: {format(parseISO(g.targetDate), 'MMMM d, yyyy')}
                    </p>
                  ) : null}

                  <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                    Updated {formatDistanceToNow(parseISO(g.updatedAt), { addSuffix: true })}
                  </p>

                  {g.status === 'active' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {updateGoalId === g.id ? (
                        <div className="w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                          <label className="text-[12px] font-medium text-[var(--color-ink)]">New value</label>
                          <Input
                            type="number"
                            value={updateValue}
                            onChange={(e) => setUpdateValue(e.target.value)}
                            className="w-full max-w-[200px]"
                          />
                          <label className="text-[12px] font-medium text-[var(--color-ink)]">Note (optional)</label>
                          <Textarea rows={2} value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={updateSaving || updateValue.trim() === ''}
                              onClick={async () => {
                                setUpdateSaving(true)
                                try {
                                  const v = parseFloat(updateValue)
                                  if (Number.isNaN(v)) {
                                    setToast('Enter a valid number')
                                    return
                                  }
                                  const updated = await patchGoal(
                                    g.id,
                                    { currentValue: v, note: updateNote.trim() || null },
                                    'Progress updated'
                                  )
                                  setUpdateGoalId(null)
                                  setUpdateValue('')
                                  setUpdateNote('')
                                  if (updated?.status === 'achieved') {
                                    setCelebrateGoal(updated)
                                    setShowConfetti(true)
                                    window.setTimeout(() => setShowConfetti(false), 3200)
                                  }
                                } finally {
                                  setUpdateSaving(false)
                                }
                              }}
                            >
                              {updateSaving ? 'Saving…' : 'Save update'}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setUpdateGoalId(null)
                                setUpdateValue('')
                                setUpdateNote('')
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" size="sm" className="min-h-9" onClick={() => setUpdateGoalId(g.id)}>
                          Update progress
                        </Button>
                      )}
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal isOpen={addOpen} onClose={() => !addSaving && setAddOpen(false)} title="Add goal">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium">Title *</label>
            <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="e.g. Run a 5K" />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium">Category</label>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[14px]"
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
            >
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium">Description (optional)</label>
            <Textarea rows={3} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[14px]">
            <input type="checkbox" checked={measurable} onChange={(e) => setMeasurable(e.target.checked)} />
            Is this measurable?
          </label>
          {measurable ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[12px] text-[var(--color-muted)]">Start</label>
                <Input value={addStart} onChange={(e) => setAddStart(e.target.value)} type="number" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[var(--color-muted)]">Target</label>
                <Input value={addTarget} onChange={(e) => setAddTarget(e.target.value)} type="number" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[var(--color-muted)]">Unit</label>
                <Input value={addUnit} onChange={(e) => setAddUnit(e.target.value)} placeholder="lbs, km…" />
              </div>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-[13px] font-medium">Target date (optional)</label>
            <Input type="date" value={addTargetDate} onChange={(e) => setAddTargetDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitAdd()} disabled={addSaving || !addTitle.trim()}>
              {addSaving ? 'Creating…' : 'Create goal'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editGoal}
        onClose={() => !editSaving && setEditGoal(null)}
        title="Edit goal"
      >
        {editGoal ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium">Target date</label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditGoal(null)} disabled={editSaving}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={editSaving || !editTitle.trim()}
                onClick={async () => {
                  setEditSaving(true)
                  try {
                    await patchGoal(
                      editGoal.id,
                      { title: editTitle.trim(), targetDate: editDate.trim() || null },
                      'Goal updated'
                    )
                    setEditGoal(null)
                  } finally {
                    setEditSaving(false)
                  }
                }}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!celebrateGoal}
        onClose={() => setCelebrateGoal(null)}
        title="Goal achieved!"
      >
        {celebrateGoal ? (
          <div className="space-y-4 text-center">
            <p className="text-3xl" aria-hidden>
              🏆
            </p>
            <p className="text-[16px] font-semibold text-[var(--color-ink)]">
              {clientFirstName.trim() || fullName.split(' ')[0] || 'there'} achieved: {celebrateGoal.title}
            </p>
            <Button type="button" className="w-full min-h-[44px]" onClick={() => void shareAchievement(celebrateGoal)}>
              Share with client
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setCelebrateGoal(null)}>
              Close
            </Button>
          </div>
        ) : null}
      </Modal>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[110] max-w-sm -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-ink)] px-4 py-2 text-center text-[14px] text-white">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
