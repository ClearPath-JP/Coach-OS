'use client'

type ReportPayload = {
  message: string
  stack?: string
  componentStack?: string
  routePath?: string
  source?: 'window' | 'unhandledrejection' | 'react' | 'manual'
}

let lastKey = ''
let lastAt = 0
const DEDUP_MS = 45_000

function dedupKey(p: ReportPayload): string {
  return `${p.source ?? ''}:${p.message.slice(0, 160)}`
}

/**
 * Sends a single error report to POST /api/error-report (session cookie).
 * Throttles duplicate messages from the same tab within ~45s.
 */
export async function reportFrontendError(payload: ReportPayload): Promise<void> {
  if (typeof window === 'undefined') return

  const key = dedupKey(payload)
  const now = Date.now()
  if (key === lastKey && now - lastAt < DEDUP_MS) return
  lastKey = key
  lastAt = now

  try {
    await fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        message: payload.message,
        stack: payload.stack,
        componentStack: payload.componentStack,
        routePath: payload.routePath ?? window.location.pathname,
        source: payload.source,
      }),
    })
  } catch {
    /* never throw from reporter */
  }
}
