/**
 * Make a value safe for a CSV cell: neutralize spreadsheet formula-injection
 * (leading = + - @ \t \r) by prefixing a single quote, then quote-escape.
 */
export function csvSafeCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${neutralized.replace(/"/g, '""')}"`
}
