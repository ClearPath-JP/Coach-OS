/** Compare two period totals → percent change for dashboard tiles. */

export type TrendDelta = { pct: number; up: boolean }

export function trendFromCounts(current: number, previous: number): TrendDelta | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (current === 0 && previous === 0) return null
  if (previous === 0) {
    if (current === 0) return null
    return { pct: 100, up: true }
  }
  const delta = ((current - previous) / previous) * 100
  const pct = Math.min(999, Math.max(0, Math.round(Math.abs(delta))))
  return { pct, up: delta >= 0 }
}

export function formatTrendLabel(t: TrendDelta | null | undefined): {
  label: string
  up: boolean
} | null {
  if (!t) return null
  return {
    label: `${t.up ? '+' : '-'}${t.pct}%`,
    up: t.up,
  }
}
