'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export function ClientLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Invalid email or password. Please try again.')
      return
    }
    router.push('/client/portal')
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="client-email" className="login-premium-label">
            Email <span className="text-[#D92B3A]">*</span>
          </label>
          <input
            id="client-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="login-premium-input"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="client-password" className="login-premium-label">
            Password <span className="text-[#D92B3A]">*</span>
          </label>
          <div className="relative">
            <input
              id="client-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cn('login-premium-input', 'pr-12')}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex size-10 min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B7FA6] transition-colors hover:text-[#0A1929]"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </div>

        <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#5B7FA6', marginBottom: '4px' }}>
          First time? Use the temporary password your coach gave you. You&apos;ll set a new one after signing in.
        </p>

        <button type="submit" className="login-premium-btn" disabled={loading}>
          <span className="login-premium-btn-inner text-white">
            {loading && <Spinner />}
            {loading ? 'Signing in...' : 'Sign in'}
          </span>
        </button>
      </form>

      {error && (
        <div className="login-premium-error-card" role="alert" aria-live="assertive">
          <span className="login-premium-error-card__icon" aria-hidden>
            ⚠
          </span>
          <p className="login-premium-error-card__text">{error}</p>
        </div>
      )}

      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E8F1F9',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '14px', color: '#5B7FA6' }}>Having trouble? Contact your coach</p>
        <p style={{ marginTop: '12px', fontSize: '12px', color: '#5B7FA6' }}>
          <Link href="/login" className="font-medium hover:underline" style={{ color: '#3B9EE8' }}>
            Coach? Sign in here →
          </Link>
        </p>
        <p style={{ marginTop: '8px', fontSize: '12px', color: '#9BB5CC' }}>
          <Link href="/terms" className="hover:underline" style={{ color: '#5B7FA6' }}>
            Terms of Service
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <Link href="/privacy" className="hover:underline" style={{ color: '#5B7FA6' }}>
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
