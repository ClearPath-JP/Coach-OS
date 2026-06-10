'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isSafeAuthRedirectPath, safeRedirectFromNextQuery } from '@/lib/safe-auth-redirect'

/* ───────────────── helpers ───────────────── */

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

type LoginRole = 'coach' | 'student'
type ViewState = 'select' | 'form'

/* ───────────────── Wordmark ───────────────── */

function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <div
      className="font-[family-name:var(--font-display)] font-extrabold leading-none tracking-[-0.02em] text-[var(--ink)]"
      style={{ fontSize: size }}
    >
      Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
    </div>
  )
}

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/* ───────────────── Role Select Screen ───────────────── */

const VALUE_BULLETS = ['Your classes', 'Payments', 'Videos', 'Schedule']

function RoleSelect({ onSelect }: { onSelect: (role: LoginRole) => void }) {
  return (
    <div className="relative z-10 flex w-full max-w-[600px] flex-col items-center gap-7 px-5">
      {/* Headline — what Korva is, in one line */}
      <h1 className="text-center font-[family-name:var(--font-display)] text-[clamp(24px,5vw,34px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--ink)]">
        Run your whole coaching business.
      </h1>

      {/* Two role cards */}
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Coach card */}
        <button
          type="button"
          onClick={() => onSelect('coach')}
          aria-label="Sign in as a coach"
          className="tile-yellow arcade-lift arcade-press flex flex-col items-center gap-3 px-6 py-8 text-center"
        >
          <span className="text-[44px] leading-none" aria-hidden>🥋</span>
          <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--ink)]">
            Coach
          </span>
          <span className="font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--ink)]/70">
            Run your dojo
          </span>
        </button>

        {/* Student card */}
        <button
          type="button"
          onClick={() => onSelect('student')}
          aria-label="Sign in as a student"
          className="tile-teal arcade-lift arcade-press flex flex-col items-center gap-3 px-6 py-8 text-center"
        >
          <span className="text-[44px] leading-none" aria-hidden>🎒</span>
          <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.02em] text-white">
            Student
          </span>
          <span className="font-[family-name:var(--font-display)] text-[13px] font-bold text-white/80">
            Your training
          </span>
        </button>
      </div>

      {/* Value micro-bullets — what every coach owns */}
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
        {VALUE_BULLETS.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-2.5">
            <span className="font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
              {t}
            </span>
            {i < VALUE_BULLETS.length - 1 && (
              <span aria-hidden className="text-[var(--belt-yellow)]">•</span>
            )}
          </span>
        ))}
      </div>

      {/* Signup link — coaches only (students are invited by their coach) */}
      <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)]">
        New coach?{' '}
        <Link
          href="/signup"
          className="text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2 hover:decoration-[3px]"
        >
          Open your dojo
        </Link>
      </p>

      {/* Founder credibility */}
      <p className="font-[family-name:var(--font-display)] text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
        Built by a coach, for coaches.
      </p>
    </div>
  )
}

/* ───────────────── Login Form Card ───────────────── */

const FIELD_CLASS =
  'h-12 w-full rounded-[12px] border-2 border-[var(--ink)] bg-white px-3.5 text-[15px] text-[var(--ink)] outline-none transition-shadow duration-150 placeholder:text-[var(--text-quaternary)] focus:shadow-[0_0_0_3px_var(--belt-yellow)]'

const FIELD_CLASS_ERROR =
  'h-12 w-full rounded-[12px] border-2 border-[var(--error)] bg-white px-3.5 text-[15px] text-[var(--ink)] outline-none transition-shadow duration-150 placeholder:text-[var(--text-quaternary)] focus:shadow-[0_0_0_3px_var(--error-bg)]'

const LABEL_CLASS =
  'mb-1.5 block font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]'

function LoginForm({
  role,
  onBack,
}: {
  role: LoginRole
  onBack: () => void
}) {
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emailEmpty = email.trim().length === 0
  const emailError =
    submitted && emailEmpty
      ? 'Enter your email.'
      : emailTouched && !emailEmpty && !isValidEmail(email)
        ? 'Enter a valid email address.'
        : null
  const passwordError = submitted && password.length === 0 ? 'Enter your password.' : null

  const rateLimitMessage =
    searchParams.get('error') === 'rate_limit'
      ? 'Too many failed sign-in attempts. Please try again in 15 minutes.'
      : null
  const passwordResetMessage =
    searchParams.get('message') === 'password_reset'
      ? 'Your password has been updated. Sign in with your new password.'
      : null
  const verifyEmailMessage =
    searchParams.get('verify') === '1'
      ? 'Check your email to confirm your account, then sign in.'
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitted(true)
    setEmailTouched(true)
    if (!isValidEmail(email) || password.length === 0) return
    setLoading(true)
    const intent = role === 'coach' ? 'coach' : 'client'
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, intent }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      data?: { redirect?: string }
    }
    setLoading(false)
    if (!res.ok) {
      if (res.status === 429) {
        setError('Too many attempts — please wait a minute and try again.')
      } else if (res.status === 401) {
        setError('Incorrect email or password.')
      } else if (typeof json.error === 'string' && json.error.length > 0) {
        setError(json.error)
      } else {
        setError('Incorrect email or password.')
      }
      return
    }
    const defaultPath = role === 'coach' ? '/' : '/client/portal'
    const serverRedirect =
      typeof json.data?.redirect === 'string' && isSafeAuthRedirectPath(json.data.redirect)
        ? json.data.redirect
        : null
    const fromNext = safeRedirectFromNextQuery(nextParam)
    window.location.assign(serverRedirect ?? fromNext ?? defaultPath)
  }

  const isSensei = role === 'coach'

  return (
    <div className="relative z-10 mx-4 w-full max-w-[420px]">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-tertiary)] transition-colors hover:text-[var(--ink)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Brutal card */}
      <div className="rounded-[18px] border-[3px] border-[var(--ink)] bg-white px-7 py-7 shadow-[6px_6px_0_var(--ink)]">
        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ink)]">
            {isSensei ? 'Welcome back to your dojo' : 'Enter the dojo'}
          </h1>
          <p className="mt-1.5 font-[family-name:var(--font-display)] text-[13px] font-semibold text-[var(--text-tertiary)]">
            {isSensei ? 'Sign in to your coaching workspace.' : 'Sign in to your training portal.'}
          </p>
        </div>

        {/* Alerts */}
        {rateLimitMessage && (
          <div role="alert" className="mb-4 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-coral)] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[2px_2px_0_var(--ink)]">
            {rateLimitMessage}
          </div>
        )}
        {passwordResetMessage && !rateLimitMessage && (
          <div role="status" className="mb-4 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-teal)] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[2px_2px_0_var(--ink)]">
            {passwordResetMessage}
          </div>
        )}
        {verifyEmailMessage && !rateLimitMessage && !passwordResetMessage && (
          <div role="status" className="mb-4 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-teal)] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[2px_2px_0_var(--ink)]">
            {verifyEmailMessage}
          </div>
        )}

        {/* Form — method=post is a no-JS safety net; submit is always intercepted below */}
        <form method="post" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="login-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              aria-invalid={emailError ? true : undefined}
              className={emailError ? FIELD_CLASS_ERROR : FIELD_CLASS}
            />
            {emailError && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{emailError}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-password" className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="font-[family-name:var(--font-display)] text-[11px] font-bold text-[var(--text-tertiary)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2 hover:text-[var(--ink)]"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                aria-invalid={passwordError ? true : undefined}
                className={`${passwordError ? FIELD_CLASS_ERROR : FIELD_CLASS} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)] transition-colors hover:text-[var(--ink)]"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
            {passwordError && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{passwordError}</p>}
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-coral)] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[2px_2px_0_var(--ink)]">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-[-0.01em] text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_var(--ink)]"
          >
            {loading ? (
              <span className="size-[18px] animate-spin rounded-full border-2 border-[var(--ink)]/30 border-t-[var(--ink)]" />
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Divider */}
        <div aria-hidden className="my-5 h-0.5 bg-[var(--border-subtle)]" />

        {/* Footer — coaches sign up; students are invited by their coach */}
        <div className="text-center">
          {isSensei ? (
            <p className="font-[family-name:var(--font-display)] text-[13px] font-semibold text-[var(--text-tertiary)]">
              New here?{' '}
              <Link
                href="/signup"
                className="text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2 hover:decoration-[3px]"
              >
                Open your dojo
              </Link>
            </p>
          ) : (
            <p className="font-[family-name:var(--font-display)] text-[13px] font-semibold text-[var(--text-tertiary)]">
              Need access? Ask your coach for your invite.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ───────────────── Main component ───────────────── */

export function DualRoleLoginPage() {
  const searchParams = useSearchParams()
  // Coach signup redirects to /login?verify=1 — open the coach form directly so the
  // "check your email" notice (rendered inside the form card) is actually visible.
  const [view, setView] = useState<ViewState>(
    searchParams.get('verify') === '1' ? 'form' : 'select'
  )
  const [role, setRole] = useState<LoginRole>('coach')

  function handleRoleSelect(r: LoginRole) {
    setRole(r)
    setView('form')
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[var(--bg-app)]">
      {/* ═══ TOP BAR ═══ */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <Wordmark size={20} />
        <p className="hidden font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:block">
          Focus. Train. Evolve.
        </p>
      </div>

      {/* ═══ CONTENT ═══ */}
      {view === 'select' ? (
        <RoleSelect onSelect={handleRoleSelect} />
      ) : (
        <LoginForm role={role} onBack={() => setView('select')} />
      )}
    </div>
  )
}
