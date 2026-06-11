'use client'

import { addMinutes, format, isSameDay, parseISO } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SessionForDrawer } from './SessionDetailDrawer'
import {
  clientColorForId,
  fullName,
  isWithinAvailabilityMonSun,
  type AvailabilityRule,
} from './schedule-lib'
import { twelveHourLabel } from './sessionFormOptions'

const PX_PER_MINUTE = 1
const HEADER_PX = 72
const TIME_COL_W = 48

export type SessionRow = SessionForDrawer

type ScheduleWeekGridProps = {
  weekDays: Date[]
  sessions: SessionRow[]
  rules: AvailabilityRule[]
  startHour: number
  endHour: number
  now: Date
  onBookSlot: (dateIso: string, timeHHmm: string) => void
  onOpenSession: (s: SessionRow) => void
}

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Half-open [slotStart, slotEnd) overlaps [sessionStart, sessionEnd) */
function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

export function ScheduleWeekGrid({
  weekDays,
  sessions,
  rules,
  startHour,
  endHour,
  onBookSlot,
  onOpenSession,
  now,
}: ScheduleWeekGridProps) {
  const gridStartMins = startHour * 60
  const gridEndMins = endHour * 60
  const totalMins = gridEndMins - gridStartMins
  const gridHeightPx = totalMins * PX_PER_MINUTE

  const halfHourStarts: number[] = []
  for (let m = 0; m < totalMins; m += 30) {
    halfHourStarts.push(gridStartMins + m)
  }

  const sessionsForDay = (day: Date) =>
    sessions.filter((s) => isSameDay(parseISO(s.scheduled_time), day))

  const sessionRange = (s: SessionRow): { start: number; end: number } => {
    const start = parseISO(s.scheduled_time)
    const end = s.end_time ? parseISO(s.end_time) : addMinutes(start, s.duration_minutes ?? 60)
    return { start: minutesFromMidnight(start), end: minutesFromMidnight(end) }
  }

  const timeLine =
    weekDays.findIndex((d) => isSameDay(d, now)) >= 0
      ? (() => {
          const idx = weekDays.findIndex((d) => isSameDay(d, now))
          const mins = minutesFromMidnight(now)
          if (mins < gridStartMins || mins > gridEndMins) return null
          const top = HEADER_PX + (mins - gridStartMins) * PX_PER_MINUTE
          return { dayIndex: idx, top }
        })()
      : null

  const formatSlotLabel = (absMins: number) => {
    const h = Math.floor(absMins / 60)
    const m = absMins % 60
    const d = new Date(2000, 0, 1, h, m)
    return format(d, 'h:mm a')
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border-[2px] border-[var(--ink)] bg-[var(--bg-subtle)] shadow-[var(--shadow-md)]">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-auto">
        {/* Day header row */}
        <div className="flex min-w-[640px]">
          <div className="shrink-0" style={{ width: TIME_COL_W }} />
          {weekDays.map((day) => {
            const today = isSameDay(day, now)
            const daySessions = sessionsForDay(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-w-0 flex-1 border-b-[2px] border-l border-[var(--border-subtle)] px-1 py-2 text-center first:border-l-0',
                  today ? 'border-b-[var(--ink)] bg-[rgba(255,210,63,0.18)]' : 'bg-[var(--bg-subtle)]'
                )}
                style={{ height: HEADER_PX }}
              >
                <span className={cn('block text-[10px] font-bold uppercase tracking-[0.12em]', today ? 'text-[var(--ink)]' : 'text-[var(--text-tertiary)]')}>
                  {format(day, 'EEE').toUpperCase()}
                </span>
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-8 min-w-[32px] items-center justify-center font-[family-name:var(--font-display)] text-[20px] font-extrabold tabular-nums text-[var(--text-primary)]',
                    today && 'rounded-[10px] border-2 border-[var(--ink)] bg-[var(--belt-yellow)] px-2 text-[18px] text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {daySessions.length > 0 ? (
                  <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                    {daySessions.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: clientColorForId(s.client_id) }}
                      />
                    ))}
                    {daySessions.length > 3 ? (
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">+{daySessions.length - 3}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Time gutter + day columns */}
        <div className="flex min-w-[640px]">
          {/* Time column */}
          <div className="sticky left-0 z-[2] shrink-0 border-r-[2px] border-[var(--ink)] bg-[var(--bg-subtle)]" style={{ width: TIME_COL_W }}>
            {halfHourStarts.map((absMins) => {
              const isMainHour = absMins % 60 === 0
              return (
                <div
                  key={absMins}
                  className={cn(
                    'flex items-start justify-end pr-1 pt-0.5 text-[11px] tabular-nums font-semibold text-[var(--text-tertiary)]',
                    isMainHour
                      ? 'border-b border-[var(--border-subtle)]'
                      : ''
                  )}
                  style={{ height: 30 }}
                >
                  {isMainHour ? twelveHourLabel(Math.floor(absMins / 60), absMins % 60) : ''}
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const daySessions = sessionsForDay(day)
            const todayCol = isSameDay(day, now)

            const ruleSegments = rules
              .filter((r) => r.day_of_week === (day.getDay() === 0 ? 6 : day.getDay() - 1))
              .map((r) => {
                const sp = r.start_time.slice(0, 5).split(':').map((x) => parseInt(x, 10))
                const ep = r.end_time.slice(0, 5).split(':').map((x) => parseInt(x, 10))
                const sM = (sp[0] ?? 0) * 60 + (sp[1] ?? 0)
                const eM = (ep[0] ?? 0) * 60 + (ep[1] ?? 0)
                const top = Math.max(0, sM - gridStartMins) * PX_PER_MINUTE
                const h = Math.max(0, Math.min(gridEndMins, eM) - Math.max(gridStartMins, sM)) * PX_PER_MINUTE
                return { top, h }
              })
              .filter((x) => x.h > 0)

            return (
              <div
                key={`col-${dayStr}`}
                className={cn(
                  'relative min-w-0 flex-1 border-l border-[var(--border-subtle)] first:border-l-0',
                  todayCol ? 'bg-[rgba(255,210,63,0.07)]' : 'bg-[var(--bg-subtle)]'
                )}
                style={{ height: gridHeightPx }}
              >
                {/* Availability tint segments */}
                {ruleSegments.map((seg, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute right-0 left-0 bg-[rgba(46,196,182,0.13)]"
                    style={{ top: seg.top, height: seg.h }}
                  />
                ))}

                {/* Slot buttons */}
                {halfHourStarts.map((absMins) => {
                  const slotStart = absMins
                  const slotEnd = absMins + 30
                  const h = Math.floor(slotStart / 60)
                  const mi = slotStart % 60
                  const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0)
                  const inAvail =
                    rules.length === 0 || rules.some((rule) => isWithinAvailabilityMonSun(slotDate, rule))
                  const overlapsSession = daySessions.some((s) => {
                    const { start, end } = sessionRange(s)
                    return rangesOverlap(slotStart, slotEnd, start, end)
                  })
                  const hh = String(h).padStart(2, '0')
                  const mm = String(mi).padStart(2, '0')
                  const timeKey = `${hh}:${mm}`
                  const top = (slotStart - gridStartMins) * PX_PER_MINUTE

                  if (overlapsSession) {
                    return (
                      <div
                        key={`${dayStr}-${timeKey}`}
                        className="pointer-events-none absolute right-0 left-0 border-b border-dashed border-[var(--border-subtle)]"
                        style={{ top, height: 30 }}
                      />
                    )
                  }

                  return (
                    <button
                      key={`${dayStr}-${timeKey}`}
                      type="button"
                      title={inAvail ? `Book at ${formatSlotLabel(absMins)}` : 'Outside availability'}
                      className={cn(
                        'group absolute right-0 left-0 z-[1] flex items-center justify-center border-b border-[var(--border-subtle)]/60 transition-colors',
                        inAvail
                          ? 'hover:bg-[rgba(255,210,63,0.20)]'
                          : 'cursor-default'
                      )}
                      style={{ top, height: 30 }}
                      disabled={!inAvail}
                      onClick={() => {
                        if (inAvail) onBookSlot(dayStr, timeKey)
                      }}
                    >
                      {inAvail ? (
                        <Plus
                          className="h-4 w-4 text-[var(--ink)] opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  )
                })}

                {/* Session blocks */}
                {daySessions.map((s) => {
                  const start = parseISO(s.scheduled_time)
                  const end = s.end_time ? parseISO(s.end_time) : addMinutes(start, s.duration_minutes ?? 60)
                  const startM = minutesFromMidnight(start)
                  const endM = minutesFromMidnight(end)
                  const top = Math.max(0, startM - gridStartMins) * PX_PER_MINUTE
                  const rawH = Math.max(0, endM - startM) * PX_PER_MINUTE
                  const heightPx = Math.max(28, rawH)
                  const color = clientColorForId(s.client_id)
                  const name = fullName(s.clients ?? { first_name: null, last_name: null })

                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="absolute z-[3] flex flex-col justify-center overflow-hidden rounded-[8px] px-2.5 py-1 text-left transition-transform duration-100 hover:z-[4] hover:-translate-y-px"
                      style={{
                        top,
                        left: 3,
                        width: 'calc(100% - 8px)',
                        height: heightPx,
                        background: `color-mix(in srgb, ${color} 16%, #ffffff)`,
                        border: '2px solid var(--ink)',
                        borderLeft: `5px solid ${color}`,
                        boxShadow: '2px 2px 0 rgba(16,16,16,0.28)',
                      }}
                      onClick={(e) => { e.stopPropagation(); onOpenSession(s) }}
                    >
                      <span className="block text-[10px] font-bold tabular-nums leading-tight text-[var(--ink)]">
                        {format(start, 'h:mm a')}{'–'}{format(end, 'h:mm a')}
                      </span>
                      <span className="block truncate text-[12px] font-bold leading-tight text-[var(--ink)]">{name}</span>
                      {heightPx >= 50 ? (
                        <span className="block truncate text-[10px] font-medium leading-tight text-[var(--text-secondary)]">{s.session_type ?? 'Session'}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Current time indicator */}
        {timeLine ? (
          <div
            className="pointer-events-none absolute z-[10]"
            style={{
              top: timeLine.top - 1,
              left: `calc(${TIME_COL_W}px + ((100% - ${TIME_COL_W}px) * ${timeLine.dayIndex}) / ${weekDays.length})`,
              width: `calc((100% - ${TIME_COL_W}px) / ${weekDays.length})`,
              height: 2,
              background: 'var(--error)',
              boxShadow: '0 0 6px rgba(252,129,129,0.5)',
            }}
          >
            <div className="absolute -left-1 -top-1 size-2 rounded-full bg-[var(--error)]" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
