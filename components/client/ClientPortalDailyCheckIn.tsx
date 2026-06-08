'use client'

import { useCallback, useEffect, useState, useLayoutEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { portalGreetingLine } from '@/lib/portal-time-greeting'

const MOOD_EMOJI = ['😞', '😕', '😐', '😊', '🤩'] as const

function CelebrateCard({ meta }: { meta: { xp: number; streak: number; record: boolean } }) {
  const [show, setShow] = useState(false)
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div
      className="shrink-0 rounded-[var(--radius-xl)] border border-[var(--success-border)] bg-[var(--success-bg)] p-5 text-center shadow-[var(--shadow-md)] transition-[background-color,border-color] duration-300"
      role="status"
    >
      <div
        className={cn(
          'mx-auto mb-2 flex size-12 origin-center items-center justify-center rounded-full bg-[var(--success)] text-white transition-transform duration-300 ease-out',
          show ? 'scale-100' : 'scale-0'
        )}
      >
        <span className="text-xl" aria-hidden>
          ✓
        </span>
      </div>
      <p className="text-[18px] font-semibold text-[var(--success)]">Checked in! +5 XP earned 🎉</p>
      {meta.record ? (
        <p className={cn('mt-2 text-[14px] font-semibold text-[var(--cp-accent)]', 'animate-streak-pulse')}>
          🏆 New streak record! {meta.streak} days
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          🔥 {meta.streak} day streak
        </p>
      )}
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

/** When set, skips the initial GET /api/client/checkin/today (portal loads this via /api/client/portal-data). */
export function ClientPortalDailyCheckIn({
  firstName = 'there',
  serverToday,
}: {
  firstName?: string
  serverToday?: TodayDto | null
}) {
  const [view, setView] = useState<ViewState>(() =>
    serverToday !== undefined ? (serverToday?.checkin ? 'done' : 'form') : 'loading'
  )
  const [streakDays, setStreakDays] = useState(() => serverToday?.streakDays ?? 0)
  const [mood, setMood] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [todayCheckin, setTodayCheckin] = useState<TodayDto['checkin']>(() => serverToday?.checkin ?? null)
  const [error, setError] = useState<string | null>(null)
  const [celebrateMeta, setCelebrateMeta] = useState<{ xp: number; streak: number; record: boolean } | null>(null)
  // Time-based greeting is computed AFTER mount (client timezone) to avoid an SSR/client
  // hydration text mismatch (React #418). Start with a time-neutral line both sides agree on.
  const [greetLine, setGreetLine] = useState(() => `Hi, ${firstName.trim() || 'there'} 👋`)
  const loadToday = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/client/checkin/today', { credentials: 'include' })
      const json = (await res.json()) as { data?: TodayDto; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load daily check-in. Refresh the page to try again.')
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
      setError('Could not load daily check-in. Refresh the page to try again.')
      setView('form')
    }
  }, [])

  useEffect(() => {
    if (serverToday !== undefined) return
    queueMicrotask(() => void loadToday())
  }, [loadToday, serverToday])

  useEffect(() => {
    setGreetLine(portalGreetingLine(firstName))
  }, [firstName])

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
        }, 1500)
      }
    } catch {
      setError('Could not save check-in — try again.')
      setView('form')
    }
  }

  if (view === 'loading') {
    return (
      <div
        className="shrink-0 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-5 shadow-[var(--shadow-sm)]"
        aria-busy
      >
        <div className="h-5 w-3/4 max-w-xs animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="mt-6 flex justify-between gap-2">
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
        className="flex h-16 shrink-0 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--success-border)] bg-[var(--success-bg)] px-4"
        role="status"
      >
        <span className="text-[28px] leading-none" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--success)]">Checked in today ✓</p>
          {preview ? <p className="truncate text-[12px] text-[var(--text-tertiary)]">{preview}</p> : null}
        </div>
        <p className="shrink-0 text-[13px] font-medium text-[var(--cp-accent)]">🔥 {streakDays} day streak</p>
      </div>
    )
  }

  if (view === 'celebrate' && celebrateMeta) {
    return <CelebrateCard meta={celebrateMeta} />
  }

  return (
    <div
      className={cn(
        'shrink-0 rounded-[var(--radius-xl)] border-[1.5px] border-[var(--accent-muted)] bg-[var(--accent-light)] p-5 shadow-[var(--shadow-sm)]',
        error && 'border-[var(--warning-border)]'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[18px] font-semibold leading-snug text-[var(--text-primary)]">
          {greetLine}
        </h2>
        {streakDays > 0 ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--warning-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--warning)]">
            🔥 {streakDays} days
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[14px] text-[var(--text-tertiary)]">How are you feeling today?</p>
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
                'flex size-[52px] items-center justify-center rounded-full border-2 border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[24px] transition-all duration-150 ease-out',
                'hover:border-[var(--cp-accent)] hover:scale-110 hover:shadow-[var(--shadow-sm)]',
                selected &&
                  'scale-[1.15] border-[var(--cp-accent)] bg-[var(--cp-accent)] shadow-[var(--shadow-md)]'
              )}
            >
              <span aria-hidden>{em}</span>
            </button>
          )
        })}
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          mood != null ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <label className="mt-4 block">
            <span className="sr-only">Optional note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Anything on your mind? A win, a challenge, a question..."
              rows={3}
              className="min-h-[72px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
          </label>
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        className="mt-4 h-11 w-full text-[14px] font-medium"
        disabled={mood == null || view === 'submitting'}
        onClick={() => void submitCheckin()}
      >
        {view === 'submitting' ? 'Saving…' : 'Check in for today'}
      </Button>
    </div>
  )
}
