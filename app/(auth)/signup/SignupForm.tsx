'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signupSchema, type SignupInput } from '@/lib/validations'
import { cn } from '@/lib/utils'

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

  const linkStyle = { color: '#3B9EE8' } as const

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="login-premium-label">
            First name <span className="text-[#D92B3A]">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="login-premium-input"
            placeholder="Jane"
            aria-invalid={!!fieldErrors.firstName}
          />
          {fieldErrors.firstName && (
            <p className="mt-1 text-[13px] text-[#D92B3A]" role="alert">
              {fieldErrors.firstName}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="login-premium-label">
            Last name <span className="text-[#D92B3A]">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="login-premium-input"
            placeholder="Doe"
            aria-invalid={!!fieldErrors.lastName}
          />
          {fieldErrors.lastName && (
            <p className="mt-1 text-[13px] text-[#D92B3A]" role="alert">
              {fieldErrors.lastName}
            </p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="login-premium-label">
          Email <span className="text-[#D92B3A]">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="login-premium-input"
          placeholder="you@example.com"
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email && (
          <p className="mt-1 text-[13px] text-[#D92B3A]" role="alert">
            {fieldErrors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="login-premium-label">
          Password <span className="text-[#D92B3A]">*</span>
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
            className={cn('login-premium-input', 'pr-12')}
            placeholder="At least 8 characters"
            aria-invalid={!!fieldErrors.password}
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
        {fieldErrors.password && (
          <p className="mt-1 text-[13px] text-[#D92B3A]" role="alert">
            {fieldErrors.password}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="confirmPassword" className="login-premium-label">
          Confirm password <span className="text-[#D92B3A]">*</span>
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
            className={cn('login-premium-input', 'pr-12')}
            placeholder="Same as above"
            aria-invalid={!!fieldErrors.confirmPassword}
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex size-10 min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B7FA6] transition-colors hover:text-[#0A1929]"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            <EyeIcon off={showConfirm} />
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p className="mt-1 text-[13px] text-[#D92B3A]" role="alert">
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
          className="mt-1 h-4 w-4 shrink-0 rounded border-[1.5px] border-[#D0E3F0] text-[#3B9EE8] focus:ring-2 focus:ring-[#3B9EE8] focus:ring-offset-0"
        />
        <label htmlFor="acceptTerms" className="text-[14px] leading-snug" style={{ color: '#0A1929' }}>
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={linkStyle}>
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={linkStyle}>
            Privacy Policy
          </a>
        </label>
      </div>
      {fieldErrors.acceptTerms && (
        <p className="text-[13px] text-[#D92B3A]" role="alert">
          {fieldErrors.acceptTerms}
        </p>
      )}
      {submitError && (
        <div className="login-premium-error-card !mt-0" role="alert">
          <span className="login-premium-error-card__icon" aria-hidden>
            ⚠
          </span>
          <p className="login-premium-error-card__text">{submitError}</p>
        </div>
      )}
      <button type="submit" className="login-premium-btn" disabled={loading}>
        <span className="login-premium-btn-inner text-white">
          {loading && <Spinner />}
          {loading ? 'Creating account…' : 'Create account'}
        </span>
      </button>
    </form>
  )
}
