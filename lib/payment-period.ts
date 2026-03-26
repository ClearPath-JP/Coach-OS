import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'

export type SummaryPeriod = 'week' | 'month' | 'year' | 'all'

export function getSummaryRange(
  period: SummaryPeriod,
  startDate?: string | null,
  endDate?: string | null
): { start: Date; end: Date } {
  const now = new Date()
  if (startDate && endDate) {
    return { start: startOfDay(parseISO(startDate)), end: endOfDay(parseISO(endDate)) }
  }
  switch (period) {
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 0 }),
        end: endOfWeek(now, { weekStartsOn: 0 }),
      }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) }
    case 'all':
    default:
      return { start: new Date(0), end: now }
  }
}

/** YYYY-MM-DD in local calendar for payment_date column */
export function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export type PeriodBucket = 'day' | 'month'

const MAX_CHART_MONTHS = 48

export function getBucketsForRange(start: Date, end: Date): { bucket: PeriodBucket; keys: string[] } {
  const ms = end.getTime() - start.getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  if (days > 400) {
    let months = eachMonthOfInterval({ start, end })
    if (months.length > MAX_CHART_MONTHS) {
      months = months.slice(-MAX_CHART_MONTHS)
    }
    return {
      bucket: 'month',
      keys: months.map((m) => format(m, 'yyyy-MM')),
    }
  }
  const daysInterval = eachDayOfInterval({ start, end })
  return {
    bucket: 'day',
    keys: daysInterval.map((d) => toDateString(d)),
  }
}
