'use client'

import { useCallback, useEffect, useState, useLayoutEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const MOOD_EMOJI = ['😞', '😕', '😐', '😊', '🤩'] as const
const ENERGY_EMOJI = ['🪫', '😴', '⚡', '🔋', '🚀'] as const

function CelebrateCard({ meta }: { meta: { xp: number; streak: number; record: boolean } }) {
  const [show, setShow] = useState(false)
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div
      className="shrink-0 rounded-[var(--radius-xl)] border border-[var(--success-border)] bg-[var(--success-bg)] p-6 text-center shadow-[var(--shadow-md)]"
      role="status"
    >
      <div
        className={cn(
          'mx-auto mb-3 flex size-14 origin-center items-center justify-center rounded-full bg-[var(--success)] text-white transition-transform duration-300 ease-out',
          show ? 'scale-100' : 'scale-0'
        )}
      >
        <span className="text-2xl" aria-hidden>
          ✓
        </span>
      </div>
      <p className="text-[20px] font-semibold text-[var(--success)]">Checked in! ✓</p>
      <p className="mt-2 text-[15px] font-medium text-[var(--text-primary)]">+{meta.xp} XP earned</p>
      <p className="mt-2 text-[15px] text-[var(--text-primary)]">🔥 {meta.streak} day streak!</p>
      {meta.record ? (
        <p className="mt-1 text-[14px] font-medium text-[var(--accent)]">🏆 New streak record!</p>
      ) : null}
    </div>
  )
}

type TodayDto = {
  checkin: {
    id: string
    moodScore: number
    energyScore: number | null
    note: string | null
    checkinDate: string
    createdAt: string
  } | null
  streakDays: number
}

type ViewState = 'loading' | 'form' | 'submitting' | 'celebrate' | 'done'

export function ClientPortalDailyCheckIn() {
  const [view, setView] = useState<ViewState>('loading')
  const [streakDays, setStreakDays] = useState(0)
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [todayCheckin, setTodayCheckin] = useState<TodayDto['checkin']>(null)
  const [error, setError] = useState<string | null>(null)
  const [celebrateMeta, setCelebrateMeta] = useState<{ xp: number; streak: number; record: boolean } | null>(null)

  const loadToday = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/client/checkin/today', { credentials: 'include' })
      const json = (await res.json()) as { data?: TodayDto; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load check-in')
        setView('form')
        return
      }
      const d = json.data
      if (!d) {
        setView('form')
        return
      }
      setStreakDays(d.streakDays)
      if (d.checkin) {
        setTodayCheckin(d.checkin)
        setView('done')
      } else {
        setTodayCheckin(null)
        setView((v) => (v === 'celebrate' || v === 'submitting' ? v : 'form'))
      }
    } catch {
      setError('Something went wrong — try again')
      setView('form')
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void loadToday())
  }, [loadToday])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadToday()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadToday])

  async function submitCheckin() {
    if (mood == null) return
    setView('submitting')
    setError(null)
    try {
      const res = await fetch('/api/client/checkin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodScore: mood,
          energyScore: energy ?? undefined,
          note: note.trim() || undefined,
        }),
      })
      const json = (await res.json()) as {
        alreadyCheckedIn?: boolean
        existing?: TodayDto['checkin']
        data?: { checkin: TodayDto['checkin']; xpAwarded: number; streakDays: number; isNewStreakRecord: boolean }
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not save check-in')
        setView('form')
        return
      }
      if (json.alreadyCheckedIn && json.existing) {
        setTodayCheckin(json.existing)
        setView('done')
        void loadToday()
        return
      }
      if (json.data?.checkin) {
        setTodayCheckin(json.data.checkin)
        setCelebrateMeta({
          xp: json.data.xpAwarded,
          streak: json.data.streakDays,
          record: json.data.isNewStreakRecord,
        })
        setStreakDays(json.data.streakDays)
        setView('celebrate')
        try {
          window.dispatchEvent(new Event('clearpath:checkin-updated'))
        } catch {
          /* ignore */
        }
        window.setTimeout(() => {
          setView('done')
          setCelebrateMeta(null)
        }, 2000)
      }
    } catch {
      setError('Something went wrong — try again')
      setView('form')
    }
  }

  if (view === 'loading') {
    return (
      <div
        className="shrink-0 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] p-6 shadow-[var(--shadow-md)]"
        aria-busy
      >
        <div className="h-5 w-3/4 max-w-xs animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="mt-6 flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="size-[52px] shrink-0 animate-pulse rounded-full bg-[var(--bg-muted)]" />
          ))}
        </div>
      </div>
    )
  }

  if (view === 'done' && todayCheckin) {
    const emoji = MOOD_EMOJI[(todayCheckin.moodScore - 1) as 0 | 1 | 2 | 3 | 4] ?? '😐'
    const preview = todayCheckin.note?.trim()
    return (
      <div
        className="flex h-[72px] shrink-0 items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] px-4 shadow-[var(--shadow-md)]"
        role="status"
      >
        <span className="text-[32px] leading-none" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--text-primary)]">Checked in today ✓</p>
          {preview ? (
            <p className="truncate text-[12px] text-[var(--text-tertiary)]">{preview}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-[13px] font-medium text-[var(--accent)]">
          🔥 {streakDays} day streak
        </p>
      </div>
    )
  }

  if (view === 'celebrate' && celebrateMeta) {
    return <CelebrateCard meta={celebrateMeta} />
  }

  return (
    <div
      className={cn(
        'shrink-0 rounded-[var(--radius-xl)] border-2 border-[var(--accent)] bg-[var(--bg-app)] p-6 shadow-[var(--shadow-md)]',
        error && 'border-[var(--warning-border)]'
      )}
    >
      <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
        How are you feeling today? <span aria-hidden>👋</span>
      </h2>
      <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
        Daily check-in · Takes 10 seconds · Earns 5 XP
      </p>
      {error ? <p className="mt-2 text-[13px] text-[var(--warning)]">{error}</p> : null}

      <div className="mt-4 flex flex-wrap justify-between gap-2 sm:justify-start sm:gap-3" role="group" aria-label="Mood">
        {MOOD_EMOJI.map((em, i) => {
          const v = i + 1
          const selected = mood === v
          return (
            <button
              key={v}
              type="button"
              aria-pressed={selected}
              aria-label={`Mood ${v} of 5`}
              onClick={() => setMood(v)}
              className={cn(
                'flex size-[52px] items-center justify-center rounded-full border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-[24px] transition-all duration-150',
                'hover:border-[var(--accent)] hover:scale-110',
                selected &&
                  'scale-[1.15] border-[var(--accent)] bg-[var(--accent)] shadow-[var(--shadow-md)]'
              )}
            >
              <span aria-hidden>{em}</span>
            </button>
          )
        })}
      </div>

      {mood != null ? (
        <>
          <p className="mt-4 text-[13px] font-medium text-[var(--text-primary)]">Energy level today?</p>
          <div className="mt-2 flex flex-wrap justify-between gap-2 sm:justify-start sm:gap-3" role="group" aria-label="Energy">
            {ENERGY_EMOJI.map((em, i) => {
              const v = i + 1
              const selected = energy === v
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Energy ${v} of 5`}
                  onClick={() => setEnergy(selected ? null : v)}
                  className={cn(
                    'flex size-[52px] items-center justify-center rounded-full border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] text-[24px] transition-all duration-150',
                    'hover:border-[var(--accent)] hover:scale-110',
                    selected &&
                      'scale-[1.15] border-[var(--accent)] bg-[var(--accent)] shadow-[var(--shadow-md)]'
                  )}
                >
                  <span aria-hidden>{em}</span>
                </button>
              )
            })}
          </div>

          <label className="mt-4 block">
            <span className="sr-only">Optional note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Anything on your mind? A win, a struggle, a question…"
              rows={3}
              className="min-h-[80px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
            <span className="mt-1 block text-right text-[12px] text-[var(--text-tertiary)]">
              {note.length}/300
            </span>
          </label>
        </>
      ) : null}

      <Button
        type="button"
        variant="primary"
        className="mt-4 h-12 w-full text-[15px] font-medium"
        disabled={mood == null || view === 'submitting'}
        onClick={() => void submitCheckin()}
      >
        {view === 'submitting' ? 'Saving…' : 'Check in for today'}
      </Button>
    </div>
  )
}
