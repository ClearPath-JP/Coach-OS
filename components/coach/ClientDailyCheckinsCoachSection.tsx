'use client'

import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays, eachDayOfInterval, format, parseISO, startOfDay, subDays } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

type CheckinApiRow = {
  id: string
  moodScore: number
  energyScore: number | null
  note: string | null
  checkinDate: string
  createdAt: string
}

type Trend = {
  avgMood: number | null
  avgEnergy: number | null
  totalCheckins: number
  missedDays: number
  currentStreak: number
  totalCheckinsAllTime: number
}

function circleClass(mood: number | undefined): string {
  if (mood == null) return 'border-2 border-[var(--border-default)] bg-transparent'
  if (mood >= 4) return 'border-0 bg-[var(--accent)] text-[var(--text-on-accent)]'
  if (mood >= 2) return 'border-0 bg-amber-400 text-[var(--text-primary)]'
  return 'border-0 bg-red-500 text-white'
}

function circleEmoji(mood: number | undefined): string {
  if (mood == null) return ''
  if (mood >= 5) return '🤩'
  if (mood >= 4) return '😊'
  if (mood >= 3) return '😐'
  if (mood >= 2) return '😕'
  return '😞'
}

export function ClientDailyCheckinsCoachSection({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkins, setCheckins] = useState<CheckinApiRow[]>([])
  const [trend, setTrend] = useState<Trend | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/coach/checkins?clientId=${encodeURIComponent(clientId)}&days=14`,
        { credentials: 'include' }
      )
      const json = (await res.json()) as {
        data?: { checkins: CheckinApiRow[]; trend: Trend }
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not load check-ins')
        setCheckins([])
        setTrend(null)
        return
      }
      setCheckins(json.data?.checkins ?? [])
      setTrend(json.data?.trend ?? null)
    } catch {
      setError('Something went wrong')
      setCheckins([])
      setTrend(null)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const today = startOfDay(new Date())
  const rangeStart = subDays(today, 13)
  const days14 = eachDayOfInterval({ start: rangeStart, end: today }).map((d) => format(d, 'yyyy-MM-dd'))

  const byDate = new Map(checkins.map((c) => [c.checkinDate, c]))
  const last7 = days14.slice(-7)
  const moods7 = last7.map((d) => byDate.get(d)?.moodScore).filter((m): m is number => m != null)
  const avgWeek =
    moods7.length > 0 ? Math.round((moods7.reduce((a, b) => a + b, 0) / moods7.length) * 10) / 10 : null

  const moodEmojiWeek =
    avgWeek == null ? '—' : avgWeek >= 4.5 ? '🤩' : avgWeek >= 3.5 ? '😊' : avgWeek >= 2.5 ? '😐' : avgWeek >= 1.5 ? '😕' : '😞'

  const notesRecent = [...checkins]
    .filter((c) => (c.note ?? '').trim().length > 0)
    .sort((a, b) => (a.checkinDate < b.checkinDate ? 1 : -1))
    .slice(0, 3)

  if (loading) {
    return (
      <Card variant="raised" padding="lg" className="animate-pulse">
        <div className="h-5 w-40 rounded bg-[var(--color-border)]/50" />
        <div className="mt-4 h-10 w-full rounded bg-[var(--color-border)]/40" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="raised" padding="lg">
        <h2 className="text-[var(--text-15)] font-semibold text-[var(--color-text-primary)]">Daily check-ins</h2>
        <p className="mt-2 text-[14px] text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-[14px] font-medium text-[var(--color-accent)] hover:underline"
        >
          Try again
        </button>
      </Card>
    )
  }

  return (
    <Card variant="raised" padding="lg">
      <h2 className="text-[var(--text-15)] font-semibold tracking-[0] text-[var(--color-text-primary)]">
        Daily check-ins
      </h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {days14.map((d) => {
          const row = byDate.get(d)
          const mood = row?.moodScore
          return (
            <div
              key={d}
              className="flex flex-col items-center gap-1"
              title={row ? `${d}: mood ${mood}/5` : `${d}: no check-in`}
            >
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-[14px]',
                  circleClass(mood)
                )}
              >
                {circleEmoji(mood)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 space-y-1 text-[14px] text-[var(--color-muted)]">
        <p>
          Avg this week:{' '}
          <span className="font-medium text-[var(--color-ink)]">
            {avgWeek != null ? `${avgWeek}/5 ${moodEmojiWeek}` : '—'}
          </span>
        </p>
        <p>
          Current streak:{' '}
          <span className="font-medium text-[var(--color-ink)]">
            🔥 {trend?.currentStreak ?? 0} day streak
          </span>
        </p>
        <p>
          Total check-ins:{' '}
          <span className="font-medium text-[var(--color-ink)]">
            {trend?.totalCheckinsAllTime ?? 0} check-ins total
          </span>
        </p>
      </div>

      {notesRecent.length > 0 ? (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Recent notes</p>
          <ul className="mt-2 space-y-2">
            {notesRecent.map((c) => {
              const daysAgo = differenceInCalendarDays(new Date(), parseISO(`${c.checkinDate}T12:00:00.000Z`))
              const label =
                daysAgo <= 0
                  ? 'Today'
                  : daysAgo === 1
                    ? 'Yesterday'
                    : `${daysAgo} days ago`
              return (
                <li key={c.id} className="text-[13px] text-[var(--color-muted)]">
                  <span className="font-medium text-[var(--color-ink)]">{label}:</span>{' '}
                  <span className="text-[var(--color-text-secondary)]">{(c.note ?? '').trim()}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
