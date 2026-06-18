'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signupSchema, type SignupInput } from '@/lib/validations'

type FieldErrors = Partial<Record<keyof SignupInput | 'submit', string>>

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
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

const INPUT_CLASS =
  'h-12 w-full rounded-[12px] border-2 border-[var(--ink)] bg-white px-3.5 text-[15px] text-[var(--ink)] outline-none transition-shadow duration-150 placeholder:text-[var(--text-quaternary)] focus:shadow-[0_0_0_3px_var(--belt-yellow)]'

const LABEL_CLASS =
  'mb-1.5 block font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]'

const FEATURES = [
  'Invite clients, not the other way around',
  'Session videos your clients can rewatch',
  'Programs and assignments, packaged your way',
  'Get paid before they walk in the door',
]

export function SignupPageClient() {
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
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setNotice(null)
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
      if (flat.firstName?.[0]) next.firstName = flat.firstName[0]
      if (flat.lastName?.[0]) next.lastName = flat.lastName[0]
      if (flat.email?.[0]) next.email = flat.email[0]
      if (flat.password?.[0]) next.password = flat.password[0]
      if (flat.confirmPassword?.[0]) next.confirmPassword = flat.confirmPassword[0]
      if (flat.acceptTerms?.[0]) next.acceptTerms = flat.acceptTerms[0]
      setFieldErrors(next)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = typeof json.error === 'string' ? json.error : 'Something went wrong.'
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
          setSubmitError('An account with this email already exists.')
        } else if (res.status === 429) {
          setSubmitError(msg)
        } else {
          setSubmitError(msg)
        }
        setLoading(false)
        return
      }

      // Verify-email path: the API returns a message instead of a usable session.
      // Show it here so the user knows to check their inbox before signing in.
      if (typeof json.data?.message === 'string' && json.data.message.length > 0) {
        setNotice(json.data.message)
        return
      }

      const dest = typeof json.data?.redirect === 'string' ? json.data.redirect : '/subscribe'
      router.push(dest)
      router.refresh()
    } catch {
      setSubmitError('Something went wrong — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full bg-[var(--bg-app)]">

      {/* ═══ LEFT PANEL — ink-dark feature wall (desktop only) ═══ */}
      <div className="relative hidden min-h-0 flex-col overflow-hidden border-r-[3px] border-[var(--ink)] bg-[var(--ink)] lg:flex lg:w-[45%]">
        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div className="font-[family-name:var(--font-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[#faf7f0]">
            Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
          </div>

          <div className="flex flex-col gap-7">
            <span className="arcade-badge arcade-badge-yellow self-start">🥋 Founding offer</span>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[clamp(26px,2.8vw,38px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#faf7f0]">
                Build something
                <br />
                that lasts.
              </h2>
              <p className="mt-3.5 max-w-[360px] text-[15px] font-medium leading-relaxed text-[#faf7f0]/65">
                Your coaching workspace — clients, sessions, programs, and revenue in one place.
              </p>
            </div>

            {/* Feature list */}
            <div className="mt-1 flex flex-col gap-3">
              {FEATURES.map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-content-center rounded-[7px] border-2 border-[#faf7f0]/30 bg-[var(--belt-yellow)] text-[12px] font-extrabold text-[var(--ink)]"
                  >
                    ✓
                  </span>
                  <span className="text-[14px] font-medium leading-snug text-[#faf7f0]/80">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.12em] text-[#faf7f0]/40">
            Discipline. Structure. Growth.
          </p>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — form ═══ */}
      <div className="flex min-h-[100dvh] w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 lg:min-h-0 lg:w-[55%] lg:px-12">
        <div className="w-full max-w-[480px] rounded-[18px] border-[3px] border-[var(--ink)] bg-white p-7 shadow-[6px_6px_0_var(--ink)] lg:p-9">

          {/* Mobile brand */}
          <div className="mb-6 text-center lg:hidden">
            <div className="font-[family-name:var(--font-display)] text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[var(--ink)]">
              Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="font-[family-name:var(--font-display)] text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ink)]">
              Create your workspace
            </h1>
            <p className="mt-1.5 text-[14px] font-medium text-[var(--text-tertiary)]">
              Set up your coaching platform in under a minute.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {/* Name row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className={LABEL_CLASS}>First name</label>
                <input
                  id="firstName" type="text" autoComplete="given-name" required
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT_CLASS} placeholder="Jane"
                />
                {fieldErrors.firstName && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{fieldErrors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className={LABEL_CLASS}>Last name</label>
                <input
                  id="lastName" type="text" autoComplete="family-name" required
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className={INPUT_CLASS} placeholder="Doe"
                />
                {fieldErrors.lastName && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{fieldErrors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={LABEL_CLASS}>Email</label>
              <input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS} placeholder="you@example.com"
              />
              {fieldErrors.email && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={LABEL_CLASS}>Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${INPUT_CLASS} pr-11`} placeholder="At least 8 characters"
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)] transition-colors hover:text-[var(--ink)]"
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{fieldErrors.password}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="confirmPassword" className={LABEL_CLASS}>Confirm password</label>
              <div className="relative">
                <input
                  id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${INPUT_CLASS} pr-11`} placeholder="Same as above"
                />
                <button
                  type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)] transition-colors hover:text-[var(--ink)]"
                  aria-label={showConfirm ? 'Hide' : 'Show'}
                >
                  <EyeIcon off={showConfirm} />
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className="mt-1 text-[12px] font-semibold text-[var(--error)]">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Terms */}
            <div className="mt-1 flex items-start gap-3">
              <input
                id="acceptTerms" type="checkbox" checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded-[4px] border-2 border-[var(--ink)] accent-[var(--belt-yellow)]"
              />
              <label htmlFor="acceptTerms" className="text-[13px] font-medium leading-snug text-[var(--text-secondary)]">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="font-bold text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2">Terms</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="font-bold text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2">Privacy Policy</a>
              </label>
            </div>
            {fieldErrors.acceptTerms && <p className="text-[12px] font-semibold text-[var(--error)]">{fieldErrors.acceptTerms}</p>}

            {/* Error */}
            {submitError && (
              <div role="alert" className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-coral)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
                {submitError}
              </div>
            )}

            {/* Verify-email notice */}
            {notice && (
              <div role="status" className="rounded-[12px] border-2 border-[var(--ink)] bg-[var(--belt-teal)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
                {notice}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-[-0.01em] text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_var(--ink)]"
            >
              {loading ? (
                <span className="size-[18px] animate-spin rounded-full border-2 border-[var(--ink)]/30 border-t-[var(--ink)]" />
              ) : (
                'Create my workspace'
              )}
            </button>
            <p className="text-center text-[12px] font-medium leading-relaxed text-[var(--text-tertiary)]">
              Founding offer: lock in{' '}
              <span className="font-bold text-[var(--ink)]">$99/mo for life</span>.
              {' '}Checkout right after signup — cancel anytime.
            </p>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[13px] font-medium text-[var(--text-tertiary)]">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2 hover:decoration-[3px]">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
