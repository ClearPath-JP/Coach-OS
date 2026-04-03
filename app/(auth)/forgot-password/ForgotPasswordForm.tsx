'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/set-password`,
      })
      if (resetErr) {
        setError(resetErr.message || 'Could not send reset email')
        setLoading(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong — check your connection and try again')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div
          className="mx-auto flex size-[48px] items-center justify-center rounded-full"
          style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
          aria-hidden
        >
          <span className="text-[24px] font-bold leading-none">✓</span>
        </div>
        <h2
          className="mt-6"
          style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0A1929' }}
        >
          Check your email
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: '#5B7FA6' }}>
          We sent a reset link to <span style={{ color: '#0A1929', fontWeight: 600 }}>{email.trim()}</span>
        </p>
        <Link
          href="/login"
          className="login-premium-ghost-btn"
          style={{ textDecoration: 'none' }}
        >
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1
        id="forgot-password-heading"
        style={{
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#0A1929',
          marginBottom: '6px',
          lineHeight: 1.2,
        }}
      >
        Reset your password
      </h1>
      <p style={{ fontSize: '15px', color: '#5B7FA6', marginBottom: '28px', lineHeight: 1.5 }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="forgot-email" className="login-premium-label">
            Email <span className="text-[#D92B3A]">*</span>
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-premium-input"
            placeholder="you@example.com"
          />
        </div>
        {error && (
          <div className="login-premium-error-card !mt-0" role="alert">
            <span className="login-premium-error-card__icon" aria-hidden>
              ⚠
            </span>
            <p className="login-premium-error-card__text">{error}</p>
          </div>
        )}
        <button type="submit" className="login-premium-btn" disabled={loading}>
          <span className="login-premium-btn-inner text-white">
            {loading && <Spinner />}
            {loading ? 'Sending…' : 'Send reset link'}
          </span>
        </button>
      </form>
      <p className="mt-6 text-center text-[14px]">
        <Link href="/login" className="font-medium hover:underline" style={{ color: '#3B9EE8' }}>
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
