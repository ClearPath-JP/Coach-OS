'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/** Monday = 0 … Sunday = 6 (matches calendar grid). */
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

const THIRTY_MIN_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) break
    THIRTY_MIN_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

type TimeWindow = { start: string; end: string; tempId: string }

type DayState = {
  dayOfWeek: number
  enabled: boolean
  windows: TimeWindow[]
}

function newTempId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}-${Math.random()}`
}

function emptyDay(d: number): DayState {
  return {
    dayOfWeek: d,
    enabled: false,
    windows: [{ start: '09:00', end: '17:00', tempId: newTempId() }],
  }
}

export interface AddAvailabilityModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function AddAvailabilityModal({ open, onClose, onSaved }: AddAvailabilityModalProps) {
  const [days, setDays] = useState<DayState[]>(() => WEEKDAYS.map((d) => emptyDay(d.value)))
  const [existingIds, setExistingIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadRules = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/availability')
      const json = await res.json()
      if (!res.ok) {
        setLoadError(typeof json.error === 'string' ? json.error : 'Could not load availability')
        return
      }
      const rows = (json.data ?? []) as {
        id: string
        day_of_week: number
        start_time: string
        end_time: string
        is_active: boolean
      }[]
      const active = rows.filter((r) => r.is_active)
      setExistingIds(active.map((r) => r.id))

      const byDay = new Map<number, TimeWindow[]>()
      for (const d of WEEKDAYS.map((x) => x.value)) {
        byDay.set(d, [])
      }
      for (const r of active) {
        const list = byDay.get(r.day_of_week) ?? []
        list.push({
          start: r.start_time.slice(0, 5),
          end: r.end_time.slice(0, 5),
          tempId: r.id,
        })
        byDay.set(r.day_of_week, list)
      }

      setDays(
        WEEKDAYS.map((wd) => {
          const wins = byDay.get(wd.value) ?? []
          return {
            dayOfWeek: wd.value,
            enabled: wins.length > 0,
            windows: wins.length ? wins : [{ start: '09:00', end: '17:00', tempId: newTempId() }],
          }
        })
      )
    } catch {
      setLoadError('Could not load availability')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadRules()
  }, [open, loadRules])

  if (!open) return null

  const setDayEnabled = (dayOfWeek: number, enabled: boolean) => {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              enabled,
              windows: d.windows.length ? d.windows : [{ start: '09:00', end: '17:00', tempId: newTempId() }],
            }
          : d
      )
    )
  }

  const updateWindow = (dayOfWeek: number, tempId: string, field: 'start' | 'end', value: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              windows: d.windows.map((w) => (w.tempId === tempId ? { ...w, [field]: value } : w)),
            }
          : d
      )
    )
  }

  const addWindow = (dayOfWeek: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              enabled: true,
              windows: [...d.windows, { start: '12:00', end: '13:00', tempId: newTempId() }],
            }
          : d
      )
    )
  }

  const removeWindow = (dayOfWeek: number, tempId: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d
        const next = d.windows.filter((w) => w.tempId !== tempId)
        return {
          ...d,
          windows: next.length ? next : [{ start: '09:00', end: '17:00', tempId: newTempId() }],
        }
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    for (const d of days) {
      if (!d.enabled) continue
      for (const w of d.windows) {
        if (w.end <= w.start) {
          setError(`${WEEKDAYS.find((x) => x.value === d.dayOfWeek)?.label}: end time must be after start`)
          return
        }
      }
    }

    setLoading(true)
    try {
      for (const id of existingIds) {
        const res = await fetch(`/api/availability/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError(typeof j.error === 'string' ? j.error : 'Could not clear old availability')
          setLoading(false)
          return
        }
      }

      for (const d of days) {
        if (!d.enabled) continue
        for (const w of d.windows) {
          const res = await fetch('/api/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dayOfWeek: d.dayOfWeek,
              startTime: `${w.start}:00`,
              endTime: `${w.end}:00`,
            }),
          })
          const json = await res.json()
          if (!res.ok) {
            setError(typeof json.error === 'string' ? json.error : 'Could not save availability')
            setLoading(false)
            return
          }
        }
      }

      onSaved()
      onClose()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="availability-modal-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-[var(--shadow-lg)] max-md:max-w-none md:rounded-xl max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="availability-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
          My availability
        </h2>
        <p className="mt-1 text-[14px] text-[var(--text-tertiary)]">Set your regular coaching hours.</p>

        {loadError ? <p className="mt-3 text-sm text-[var(--error)]">{loadError}</p> : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {days.map((d) => {
            const label = WEEKDAYS.find((x) => x.value === d.dayOfWeek)?.label ?? ''
            return (
              <div
                key={d.dayOfWeek}
                className={cn(
                  'rounded-xl border border-[var(--border-default)] p-3',
                  d.enabled ? 'bg-[var(--cp-offwhite)]' : 'bg-[var(--bg-subtle)]'
                )}
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => setDayEnabled(d.dayOfWeek, e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
                </label>
                {d.enabled ? (
                  <div className="mt-3 space-y-3 pl-6">
                    {d.windows.map((w) => (
                      <div key={w.tempId} className="flex flex-wrap items-center gap-2">
                        <select
                          value={w.start}
                          onChange={(e) => updateWindow(d.dayOfWeek, w.tempId, 'start', e.target.value)}
                          className="min-h-10 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-2 text-[13px]"
                        >
                          {THIRTY_MIN_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="text-[13px] text-[var(--text-tertiary)]">to</span>
                        <select
                          value={w.end}
                          onChange={(e) => updateWindow(d.dayOfWeek, w.tempId, 'end', e.target.value)}
                          className="min-h-10 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-2 text-[13px]"
                        >
                          {THIRTY_MIN_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[var(--error)]"
                          onClick={() => removeWindow(d.dayOfWeek, w.tempId)}
                          aria-label="Remove window"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-[13px] font-medium text-[var(--cp-accent)] hover:underline"
                      onClick={() => addWindow(d.dayOfWeek)}
                    >
                      + Add break
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 pl-6 text-[13px] text-[var(--text-quaternary)]">Day off</p>
                )}
              </div>
            )
          })}

          {error ? (
            <p className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!loadError}>
              {loading ? 'Saving…' : 'Save availability'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
