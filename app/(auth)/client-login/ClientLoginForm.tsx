'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { isSafeAuthRedirectPath } from '@/lib/safe-auth-redirect'
import { cn } from '@/lib/utils'

export function ClientLoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const rateLimitMessage =
    searchParams.get('error') === 'rate_limit'
      ? 'Too many failed sign-in attempts. Please try again in 15 minutes.'
      : null
  const sessionInvalidatedMessage =
    searchParams.get('reason') === 'session'
      ? 'Your session expired. Please sign in again.'
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, intent: 'client' }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      data?: { redirect?: string }
    }
    setLoading(false)
    if (!res.ok) {
      setError(
        typeof json.error === 'string'
          ? json.error
          : 'Invalid email or password. Please try again.'
      )
      return
    }
    const serverRedirect =
      typeof json.data?.redirect === 'string' && isSafeAuthRedirectPath(json.data.redirect)
        ? json.data.redirect
        : null
    window.location.assign(serverRedirect ?? '/client/portal')
  }

  return (
    <div>
      {/* Alerts */}
      {rateLimitMessage && (
        <div
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--error)]"
          role="alert"
          aria-live="polite"
        >
          <span className="mt-0.5 shrink-0">&#9888;</span>
          <p>{rateLimitMessage}</p>
        </div>
      )}
      {sessionInvalidatedMessage && !rateLimitMessage && (
        <div
          className="mb-4 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--warning)]"
          role="status"
          aria-live="polite"
        >
          {sessionInvalidatedMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="client-email"
            className="mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]"
          >
            Email
          </label>
          <input
            id="client-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={cn(
              'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] px-3.5 py-2.5',
              'text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]',
              'outline-none transition-all',
              'focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(159,18,57,0.25)]'
            )}
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="client-password"
            className="mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="client-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={cn(
                'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] px-3.5 py-2.5 pr-12',
                'text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]',
                'outline-none transition-all',
                'focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(159,18,57,0.25)]'
              )}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-quaternary)] transition-colors hover:text-[var(--text-secondary)]"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-[18px]" strokeWidth={1.5} />
              ) : (
                <Eye className="size-[18px]" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        {/* Helper text */}
        <p className="text-[12px] leading-relaxed text-[var(--text-quaternary)]">
          First time? Use the temporary password your coach gave you.
        </p>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'relative w-full overflow-hidden rounded-lg px-4 py-2.5',
            'text-[14px] font-medium text-white',
            'bg-[var(--accent)] transition-all',
            'hover:bg-[var(--accent-hover)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)]',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <span className="flex items-center justify-center gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Sign in'}
          </span>
        </button>
      </form>

      {/* Error display */}
      {error && (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--error)]"
          role="alert"
          aria-live="assertive"
        >
          <span className="mt-0.5 shrink-0">&#9888;</span>
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
