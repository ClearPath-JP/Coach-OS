/** Time-aware greeting; pass `when` on the server so SSR matches request time. */
export function portalGreetingLine(firstName: string, when: Date = new Date()): string {
  const h = when.getHours()
  const name = firstName.trim() || 'there'
  if (h >= 5 && h < 12) return `Good morning, ${name} 👋`
  if (h >= 12 && h < 17) return `Good afternoon, ${name} 👋`
  return `Good evening, ${name} 👋`
}
