import { z } from 'zod'
import { format, parse } from 'date-fns'

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_NAMES_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export type WeeklyUnavailabilityBlock = {
  id: string
  dayOfWeek: number
  allDay: boolean
  startTime: string | null
  endTime: string | null
}

export type WeeklyUnavailabilityBlockInput = Omit<WeeklyUnavailabilityBlock, 'id'> & { id?: string }

export const weeklyUnavailabilityPutSchema = z.object({
  blocks: z.array(
    z
      .object({
        dayOfWeek: z.number().int().min(0).max(6),
        allDay: z.boolean(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.allDay) return
        if (!data.startTime || !data.endTime) {
          ctx.addIssue({
            code: 'custom',
            message: 'Add a start and end time, or mark all day.',
            path: ['startTime'],
          })
          return
        }
        if (data.startTime >= data.endTime) {
          ctx.addIssue({
            code: 'custom',
            message: 'End time must be after start time.',
            path: ['endTime'],
          })
        }
      })
  ),
})

export type WeeklyUnavailabilityRowDb = {
  id: string
  workspace_id: string
  coach_user_id: string | null
  client_id: string | null
  day_of_week: number
  all_day: boolean
  start_time: string | null
  end_time: string | null
}

/** Postgres TIME → "HH:mm" */
export function timeToHm(t: string | null | undefined): string | null {
  if (!t) return null
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

export function rowToBlock(row: WeeklyUnavailabilityRowDb): WeeklyUnavailabilityBlock {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    allDay: row.all_day,
    startTime: row.all_day ? null : timeToHm(row.start_time),
    endTime: row.all_day ? null : timeToHm(row.end_time),
  }
}

/** "HH:mm" for Postgres TIME */
export function hmToTime(hm: string): string {
  return hm.length === 5 ? `${hm}:00` : hm
}

export function formatBlockSummary(b: Pick<WeeklyUnavailabilityBlock, 'dayOfWeek' | 'allDay' | 'startTime' | 'endTime'>): string {
  const day = DAY_NAMES_LONG[b.dayOfWeek] ?? `Day ${b.dayOfWeek}`
  if (b.allDay) return `${day} — All day`
  if (!b.startTime || !b.endTime) return `${day}`
  try {
    const s = parse(b.startTime, 'HH:mm', new Date(2000, 0, 1))
    const e = parse(b.endTime, 'HH:mm', new Date(2000, 0, 1))
    return `${day} — ${format(s, 'h:mm a')}–${format(e, 'h:mm a')}`
  } catch {
    return `${day} — ${b.startTime}–${b.endTime}`
  }
}
