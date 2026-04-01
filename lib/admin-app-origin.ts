/** Public app origin for auth redirects (magic links, etc.). */
export function getAdminAppOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (u) return u
  const v = process.env.VERCEL_URL?.trim()
  if (v) return v.startsWith('http') ? v : `https://${v}`
  return 'http://localhost:3000'
}
