/**
 * Client-safe: validate post-login redirect paths (open redirects).
 */
export function isSafeAuthRedirectPath(path: string | null): path is string {
  if (!path || typeof path !== 'string') return false
  if (!path.startsWith('/') || path.startsWith('//')) return false
  try {
    const pathname = new URL(path, 'http://localhost').pathname
    if (pathname === '/' || pathname === '/client/portal') return true
    return (
      pathname.startsWith('/coach/') ||
      pathname.startsWith('/client/') ||
      pathname.startsWith('/onboarding') ||
      pathname === '/billing' ||
      pathname.startsWith('/admin/')
    )
  } catch {
    return false
  }
}

/** `next` query may be a path or full URL — normalize then validate. */
export function safeRedirectFromNextQuery(next: string | null): string | null {
  if (!next || typeof next !== 'string') return null
  try {
    const pathname = new URL(next, 'http://localhost').pathname
    return isSafeAuthRedirectPath(pathname) ? pathname : null
  } catch {
    return null
  }
}
