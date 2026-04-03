/** Recurring rule `day_of_week`: Monday = 0 … Sunday = 6 (matches week grid). */
export type AvailabilityRule = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  label?: string | null
}

export const CLIENT_SLOT_COLORS = [
  '#3b9ee8',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#ec4899',
] as const

export function clientColorForId(clientId: string): string {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CLIENT_SLOT_COLORS[Math.abs(hash) % CLIENT_SLOT_COLORS.length]!
}

export function fullName(client: { first_name: string | null; last_name: string | null } | null | undefined): string {
  return [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Unnamed client'
}

export function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  return ((parts[0]?.[0] ?? 'C') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** JS Date.getDay(): Sun=0 … Sat=6 → rule index Mon=0 … Sun=6 */
export function dateToRuleDayOfWeek(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 6 : day - 1
}

export function isWithinAvailabilityMonSun(date: Date, rule: Pick<AvailabilityRule, 'day_of_week' | 'start_time' | 'end_time'>): boolean {
  if (dateToRuleDayOfWeek(date) !== rule.day_of_week) return false
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const value = `${hh}:${mm}`
  return value >= rule.start_time.slice(0, 5) && value < rule.end_time.slice(0, 5)
}

export function sessionTypeAccentClass(sessionType: string | null | undefined): string {
  const t = (sessionType ?? 'video').toLowerCase()
  if (t.includes('phone')) return 'bg-[var(--success)]'
  if (t.includes('person') || t.includes('in_person') || t.includes('in-person')) return 'bg-[var(--warning)]'
  return 'bg-[var(--accent)]'
}

export function sessionTypeLabel(sessionType: string | null | undefined): 'Video' | 'Phone' | 'In person' {
  const t = (sessionType ?? 'video').toLowerCase()
  if (t.includes('phone')) return 'Phone'
  if (t.includes('person') || t.includes('in_person') || t.includes('in-person')) return 'In person'
  return 'Video'
}
