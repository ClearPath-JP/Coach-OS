'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  DAY_NAMES_LONG,
  formatBlockSummary,
  type WeeklyUnavailabilityBlock,
} from '@/lib/weekly-unavailability'
function newBlock(): WeeklyUnavailabilityBlock {
  return {
    id: `new-${crypto.randomUUID()}`,
    dayOfWeek: 1,
    allDay: true,
    startTime: null,
    endTime: null,
  }
}

function blocksToPayload(blocks: WeeklyUnavailabilityBlock[]) {
  return blocks.map(({ dayOfWeek, allDay, startTime, endTime }) => ({
    dayOfWeek,
    allDay,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
  }))
}

export function WeeklyUnavailabilityEditor({ variant }: { variant: 'coach' | 'client' }) {
  const api =
    variant === 'coach' ? '/api/coach/weekly-unavailability' : '/api/client/weekly-unavailability'

  const [coachBlocks, setCoachBlocks] = useState<WeeklyUnavailabilityBlock[]>([])
  const [blocks, setBlocks] = useState<WeeklyUnavailabilityBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(api, { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not load')
        return
      }
      if (variant === 'client' && json.data?.coachBlocks && json.data?.myBlocks) {
        setCoachBlocks(json.data.coachBlocks as WeeklyUnavailabilityBlock[])
        setBlocks(json.data.myBlocks as WeeklyUnavailabilityBlock[])
      } else if (json.data?.blocks) {
        setBlocks(json.data.blocks as WeeklyUnavailabilityBlock[])
        setCoachBlocks([])
      }
    } catch {
      setError('Could not load — check your connection')
    } finally {
      setLoading(false)
    }
  }, [api, variant])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSavedAt(null)
    try {
      const res = await fetch(api, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocks: blocksToPayload(blocks) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not save')
        return
      }
      if (json.data?.blocks) {
        setBlocks(json.data.blocks as WeeklyUnavailabilityBlock[])
      }
      setSavedAt(new Date().toISOString())
    } catch {
      setError('Could not save — check your connection')
    } finally {
      setSaving(false)
    }
  }

  const updateBlock = (id: string, patch: Partial<WeeklyUnavailabilityBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b
        const next = { ...b, ...patch }
        if (patch.allDay === true) {
          next.startTime = null
          next.endTime = null
        }
        return next
      })
    )
  }

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-xl bg-[var(--color-surface)]" aria-busy="true" aria-label="Loading" />
    )
  }

  return (
    <div className="space-y-6">
      {variant === 'client' && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 md:p-5">
          <h2 className="text-base font-medium text-[var(--color-ink)]">Your coach&apos;s usual unavailable times</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Recurring times your coach is typically not free. This is a guide — confirm real times in Messages.
          </p>
          {coachBlocks.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Your coach hasn&apos;t set typical unavailable times yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-text-primary)]">
              {coachBlocks.map((b) => (
                <li key={b.id} className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  {formatBlockSummary(b)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 md:p-5">
        <h2 className="text-base font-medium text-[var(--color-ink)]">When you&apos;re usually not available</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {variant === 'coach'
            ? 'Clients see this on Sessions so they can avoid requesting those windows.'
            : 'Your coach sees this when planning. Add days or time ranges you’re typically busy.'}
        </p>

        {blocks.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No entries — nothing is marked as usually unavailable.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-[12px] font-medium text-[var(--color-muted)]">Day</label>
                  <select
                    value={b.dayOfWeek}
                    onChange={(e) => updateBlock(b.id, { dayOfWeek: Number(e.target.value) })}
                    className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                  >
                    {DAY_NAMES_LONG.map((name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-[var(--color-ink)] sm:pb-3">
                  <input
                    type="checkbox"
                    checked={b.allDay}
                    onChange={(e) => updateBlock(b.id, { allDay: e.target.checked })}
                    className="size-4 rounded border-[var(--color-border)]"
                  />
                  All day
                </label>
                {!b.allDay && (
                  <div className="flex flex-1 flex-wrap gap-2 sm:min-w-[200px]">
                    <div className="min-w-[120px] flex-1">
                      <label className="mb-1 block text-[12px] font-medium text-[var(--color-muted)]">From</label>
                      <Input
                        type="time"
                        value={b.startTime ?? ''}
                        onChange={(e) => updateBlock(b.id, { startTime: e.target.value || null })}
                        className="h-10"
                      />
                    </div>
                    <div className="min-w-[120px] flex-1">
                      <label className="mb-1 block text-[12px] font-medium text-[var(--color-muted)]">To</label>
                      <Input
                        type="time"
                        value={b.endTime ?? ''}
                        onChange={(e) => updateBlock(b.id, { endTime: e.target.value || null })}
                        className="h-10"
                      />
                    </div>
                  </div>
                )}
                <Button type="button" variant="ghost" className="text-[var(--color-error)] sm:ml-auto" onClick={() => removeBlock(b.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" onClick={() => setBlocks((p) => [...p, newBlock()])}>
            Add unavailable time
          </Button>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
            {savedAt && !error ? (
              <p className="text-sm text-[var(--color-success)]" role="status">
                Saved
              </p>
            ) : null}
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
