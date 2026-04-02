/** Progress % from start → target using current value. Null when not measurable. */
export function goalProgressPercent(params: {
  targetValue: number | null | undefined
  startValue: number | null | undefined
  currentValue: number | null | undefined
}): number | null {
  const target = params.targetValue
  if (target == null || Number.isNaN(Number(target))) return null
  const start = params.startValue != null ? Number(params.startValue) : null
  const current = params.currentValue != null ? Number(params.currentValue) : 0
  if (start == null || Number.isNaN(start)) return null
  const span = target - start
  if (Math.abs(span) < 1e-9) return current >= target ? 100 : 0
  const pct = ((current - start) / span) * 100
  return Math.min(100, Math.max(0, Math.round(pct)))
}
