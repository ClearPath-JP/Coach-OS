'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

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
          className="mx-auto flex size-12 items-center justify-center rounded-full"
          style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
          aria-hidden
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2
          className="mt-6"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
          }}
        >
          Check your email
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          We sent a reset link to{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{email.trim()}</span>
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-[14px] font-medium no-underline transition-colors duration-150 hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: '0.01em',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        Reset your password
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 24 }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-quaternary)' }}
          >
            Email
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-[10px] border px-4 text-[14px] outline-none transition-[border-color,box-shadow] duration-200"
            style={{
              background: 'var(--bg-subtle)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent)'
              e.target.style.boxShadow = '0 0 0 3px rgba(232,148,58,0.15)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-strong)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[8px] border px-3 py-2 text-[13px]"
            style={{
              background: 'var(--error-bg)',
              borderColor: 'var(--error-border)',
              color: 'var(--error)',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-[10px] border-none text-[14px] font-semibold transition-all duration-200 disabled:opacity-60"
          style={{
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <div
              style={{
                width: 18,
                height: 18,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'currentColor',
                borderRadius: '50%',
                animation: 'cp-spin 0.7s linear infinite',
              }}
            />
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
        <Link
          href="/login"
          className="font-medium no-underline transition-colors duration-150 hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Back to sign in
        </Link>
      </p>

      <style>{`
        @keyframes cp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
