export function twelveHourLabel(h24: number, minute: number): string {
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`
}

/** Label for an "HH:mm" string (24h). */
export function labelForTimeValue(hhmm: string): string {
  const parts = hhmm.split(':').map((x) => parseInt(x, 10))
  const h = parts[0]
  const m = parts[1]
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm
  return twelveHourLabel(h, m)
}

export const TIME_SLOTS: { value: string; label: string }[] = []
for (let h = 6; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) break
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    TIME_SLOTS.push({ value, label: twelveHourLabel(h, m) })
  }
}

export const SESSION_DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
] as const
