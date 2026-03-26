'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signupSchema, type SignupInput } from '@/lib/validations'

type FieldErrors = Partial<Record<keyof SignupInput | 'submit', string>>

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

export function SignupForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setFieldErrors({})

    const parsed = signupSchema.safeParse({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      confirmPassword,
      acceptTerms,
    })

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      const next: FieldErrors = {}
      const setIf = (key: keyof FieldErrors, msg: string | undefined) => {
        if (msg !== undefined) next[key] = msg
      }
      setIf('firstName', flat.firstName?.[0])
      setIf('lastName', flat.lastName?.[0])
      setIf('email', flat.email?.[0])
      setIf('password', flat.password?.[0])
      setIf('confirmPassword', flat.confirmPassword?.[0])
      setIf('acceptTerms', flat.acceptTerms?.[0])
      setFieldErrors(next)
      return
    }

    setLoading(true)
    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      })
      const signupJson = await signupRes.json().catch(() => ({}))

      if (!signupRes.ok) {
        const msg =
          typeof signupJson.error === 'string' ? signupJson.error : 'Something went wrong — please try again.'
        if (
          msg.includes('already exists') ||
          msg.includes('already') ||
          msg.includes('registered') ||
          msg.includes('exists')
        ) {
          setSubmitError('An account with this email already exists.')
        } else if (msg.includes('Password') || msg.includes('password')) {
          setFieldErrors((er) => ({ ...er, password: msg }))
        } else if (signupRes.status === 429) {
          setSubmitError(msg)
        } else {
          setSubmitError(msg)
        }
        setLoading(false)
        return
      }

      const completeRes = await fetch('/api/auth/signup-complete', {
        method: 'POST',
        credentials: 'include',
      })
      const completeJson = await completeRes.json()
      if (!completeRes.ok) {
        if (completeRes.status === 429) {
          setSubmitError(
            completeJson.error ?? 'Too many signup attempts. Please try again in 15 minutes.'
          )
        } else {
          setSubmitError(completeJson.error ?? 'Something went wrong — please try again.')
        }
        setLoading(false)
        return
      }
      router.push('/onboarding')
      router.refresh()
    } catch {
      setSubmitError('Something went wrong — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[44px]'

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              First name <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder="Jane"
              aria-invalid={!!fieldErrors.firstName}
            />
            {fieldErrors.firstName && (
              <p className="mt-1 text-sm text-[var(--color-error)]" role="alert">
                {fieldErrors.firstName}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Last name <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder="Doe"
              aria-invalid={!!fieldErrors.lastName}
            />
            {fieldErrors.lastName && (
              <p className="mt-1 text-sm text-[var(--color-error)]" role="alert">
                {fieldErrors.lastName}
              </p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
            Email <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
            Password <span className="text-[var(--color-error)]">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder="At least 8 characters"
              aria-invalid={!!fieldErrors.password}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[var(--color-muted)]"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
            Confirm password <span className="text-[var(--color-error)]">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder="Same as above"
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[var(--color-muted)]"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showConfirm} />
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-sm text-[var(--color-error)]" role="alert">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>
        <div className="flex items-start gap-3">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-border)]"
          />
          <label htmlFor="acceptTerms" className="text-[14px] leading-snug text-[var(--color-text-primary)]">
            I agree to the{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] underline hover:opacity-90"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] underline hover:opacity-90"
            >
              Privacy Policy
            </a>
          </label>
        </div>
        {fieldErrors.acceptTerms && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {fieldErrors.acceptTerms}
          </p>
        )}
        {submitError && (
          <p className="rounded-lg bg-[var(--color-error-light)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-medium text-white hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:opacity-70"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[var(--color-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
