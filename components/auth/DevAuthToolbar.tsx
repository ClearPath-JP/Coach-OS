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

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

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
      className="mb-6 rounded-lg border border-amber-200/80 border-l-[3px] border-l-[#F59E0B] bg-[#FFFBEB] px-4 py-3"
      role="region"
      aria-label="Development tools"
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide text-amber-900">
        Local development
      </p>
      <p className="mt-1 text-[13px] leading-snug text-amber-950/85">
        Clear the browser session and return to the login page to test another account or role.
      </p>
      <button
        type="button"
        onClick={() => void clear()}
        disabled={busy}
        className="mt-3 min-h-[40px] rounded-lg border border-amber-300/90 bg-white px-4 text-[13px] font-medium text-amber-950 shadow-sm transition-colors hover:bg-amber-50 disabled:opacity-60"
      >
        {busy ? 'Clearing…' : 'Clear session & go to login'}
      </button>
      {msg ? (
        <p className="mt-2 text-[12px] text-red-700" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
