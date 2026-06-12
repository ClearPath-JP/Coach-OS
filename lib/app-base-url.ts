/**
 * Canonical browser-facing origin for redirects and Stripe return URLs.
 */
export function resolveAppBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const origin = request.headers.get('origin')?.trim()
  if (origin) return origin.replace(/\/$/, '')
  return 'https://korvacoach.com'
}
