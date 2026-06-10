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
          className="mx-auto grid size-12 place-content-center rounded-full border-[3px] border-[var(--ink)] bg-[var(--belt-teal)] shadow-[3px_3px_0_var(--ink)]"
          aria-hidden
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="mt-6 font-[family-name:var(--font-display)] text-[22px] font-extrabold tracking-[-0.02em] text-[var(--ink)]">
          Check your email
        </h2>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-[var(--text-tertiary)]">
          We sent a reset link to{' '}
          <span className="font-bold text-[var(--ink)]">{email.trim()}</span>
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block font-[family-name:var(--font-display)] text-[14px] font-bold text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2 hover:decoration-[3px]"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ink)]">
        Reset your password
      </h1>
      <p className="mt-1.5 mb-6 text-[14px] font-medium text-[var(--text-tertiary)]">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-1.5 block font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]"
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
            className="h-12 w-full rounded-[12px] border-2 border-[var(--ink)] bg-white px-3.5 text-[15px] text-[var(--ink)] outline-none transition-shadow duration-150 placeholder:text-[var(--text-quaternary)] focus:shadow-[0_0_0_3px_var(--belt-yellow)]"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-coral)] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[2px_2px_0_var(--ink)]"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex h-12 w-full items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-[-0.01em] text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_var(--ink)]"
        >
          {loading ? (
            <span className="size-[18px] animate-spin rounded-full border-2 border-[var(--ink)]/30 border-t-[var(--ink)]" />
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] font-medium text-[var(--text-tertiary)]">
        <Link
          href="/login"
          className="font-bold text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2 hover:decoration-[3px]"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
