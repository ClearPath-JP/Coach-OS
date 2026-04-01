'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Local dev only: one-click clear session so every test run starts at login.
 */
export function DevAuthToolbar() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (process.env.NODE_ENV !== 'development') return null

  const clear = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/auth/dev-clear-session', { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        setMsg('Could not clear session')
        return
      }
      router.push('/login')
      router.refresh()
    } catch {
      setMsg('Could not clear session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="mb-6 rounded-[var(--radius-lg)] border border-dashed border-amber-500/50 bg-amber-50/80 px-4 py-3 dark:border-amber-600/40 dark:bg-amber-950/30"
      role="region"
      aria-label="Development tools"
    >
      <p className="text-[12px] font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
        Local development
      </p>
      <p className="mt-1 text-[13px] text-amber-950/80 dark:text-amber-100/90">
        Clear the browser session and return to the login page to test another account or role.
      </p>
      <button
        type="button"
        onClick={() => void clear()}
        disabled={busy}
        className="mt-3 min-h-[40px] rounded-[var(--radius-md)] border border-amber-700/30 bg-[var(--bg-app)] px-4 text-[13px] font-medium text-amber-950 transition-colors hover:bg-amber-100/80 disabled:opacity-60 dark:border-amber-500/30 dark:text-amber-100 dark:hover:bg-amber-900/40"
      >
        {busy ? 'Clearing…' : 'Clear session & go to login'}
      </button>
      {msg ? (
        <p className="mt-2 text-[12px] text-[var(--error)]" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
