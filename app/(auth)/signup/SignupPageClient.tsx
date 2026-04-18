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

/* ───── Decorative alchemy symbol ───── */
function AlchemySymbol() {
  return (
    <svg width="48" height="48" viewBox="0 0 100 100" fill="none" aria-hidden style={{ opacity: 0.25 }}>
      {/* Outer circle */}
      <circle cx="50" cy="50" r="44" stroke="rgba(200,170,100,0.4)" strokeWidth="1" />
      {/* Inner triangle (fire/transmutation) */}
      <polygon points="50,16 82,72 18,72" stroke="rgba(200,170,100,0.35)" strokeWidth="1" fill="none" />
      {/* Center dot */}
      <circle cx="50" cy="50" r="3" fill="rgba(200,170,100,0.3)" />
      {/* Cross-line */}
      <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(200,170,100,0.15)" strokeWidth="0.5" />
      <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(200,170,100,0.15)" strokeWidth="0.5" />
    </svg>
  )
}

const INPUT_CLASS =
  'h-11 w-full rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-quaternary)]'

const LABEL_CLASS =
  'mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-quaternary)]'

function focusGold(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--accent)'
  e.target.style.boxShadow = '0 0 0 3px rgba(159,18,57,0.15)'
}
function blurReset(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--border-default)'
  e.target.style.boxShadow = 'none'
}

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
    <div className="flex min-h-[100dvh] w-full" style={{ fontFamily: 'var(--font-dm-sans), var(--font)' }}>

      {/* ═══ LEFT PANEL — atmospheric (desktop only) ═══ */}
      <div
        className="relative hidden min-h-0 flex-col overflow-hidden lg:flex lg:w-[45%]"
        style={{ background: '#0A0908' }}
      >
        {/* Grain texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, zIndex: 1, opacity: 0.025, pointerEvents: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />

        {/* Accent glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute', bottom: '-15%', left: '20%', width: '70%', height: '60%',
            background: 'radial-gradient(ellipse, rgba(159,18,57,0.1) 0%, rgba(180,100,40,0.04) 40%, transparent 70%)',
            pointerEvents: 'none', zIndex: 1,
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500,
              letterSpacing: '0.04em', color: 'rgba(237,237,239,0.7)', lineHeight: 1,
            }}>
              COACH<span style={{ color: 'var(--accent)' }}>OS</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <AlchemySymbol />
            <div className="text-center">
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 2.5vw, 32px)',
                fontWeight: 500, letterSpacing: '0.02em', color: 'rgba(240,237,232,0.85)', lineHeight: 1.25,
              }}>
                Build something<br />that lasts.
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(200,190,170,0.4)', marginTop: 12, lineHeight: 1.5 }}>
                Your coaching workspace — clients, sessions,<br />programs, and revenue in one place.
              </p>
            </div>

            {/* Feature list */}
            <div className="flex flex-col gap-3 mt-4">
              {[
                'Invite clients, not the other way around',
                'Session videos your clients can rewatch',
                'Programs and assignments, packaged your way',
                'Get paid before they walk in the door',
              ].map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'rgba(159,18,57,0.5)', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, color: 'rgba(200,190,170,0.55)', lineHeight: 1.4 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,170,100,0.12), transparent)', marginBottom: 16 }} />
            <p style={{ fontSize: 11, color: 'rgba(200,190,170,0.25)', letterSpacing: '0.06em' }}>
              Discipline. Structure. Growth.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — form ═══ */}
      <div
        className="flex min-h-[100dvh] w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 lg:min-h-0 lg:w-[55%] lg:px-12"
        style={{ background: 'var(--bg-app)' }}
      >
        <div
          className="glass-modal w-full max-w-[480px] rounded-2xl p-7 lg:p-9"
          style={{
            background: 'rgba(24,24,27,0.5)',
            border: '1px solid rgba(159,18,57,0.12)',
            boxShadow: '0 0 60px rgba(159,18,57,0.06), 0 8px 32px rgba(0,0,0,0.3)',
          }}
        >

          {/* Mobile brand */}
          <div className="mb-6 text-center lg:hidden">
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500,
              letterSpacing: '0.04em', color: 'var(--text-primary)', lineHeight: 1,
            }}>
              COACH<span style={{ color: 'var(--accent)' }}>OS</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500,
              letterSpacing: '0.01em', color: 'var(--text-primary)',
            }}>
              Create your workspace
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Set up your coaching platform in under a minute.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3.5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className={LABEL_CLASS}>First name</label>
                <input
                  id="firstName" type="text" autoComplete="given-name" required
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT_CLASS} placeholder="Jane"
                  onFocus={focusGold} onBlur={blurReset}
                />
                {fieldErrors.firstName && <p className="mt-1 text-[12px] text-[var(--error)]">{fieldErrors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className={LABEL_CLASS}>Last name</label>
                <input
                  id="lastName" type="text" autoComplete="family-name" required
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className={INPUT_CLASS} placeholder="Doe"
                  onFocus={focusGold} onBlur={blurReset}
                />
                {fieldErrors.lastName && <p className="mt-1 text-[12px] text-[var(--error)]">{fieldErrors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={LABEL_CLASS}>Email</label>
              <input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS} placeholder="you@example.com"
                onFocus={focusGold} onBlur={blurReset}
              />
              {fieldErrors.email && <p className="mt-1 text-[12px] text-[var(--error)]">{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={LABEL_CLASS}>Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${INPUT_CLASS} pr-11`} placeholder="At least 8 characters"
                  onFocus={focusGold} onBlur={blurReset}
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-[12px] text-[var(--error)]">{fieldErrors.password}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="confirmPassword" className={LABEL_CLASS}>Confirm password</label>
              <div className="relative">
                <input
                  id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${INPUT_CLASS} pr-11`} placeholder="Same as above"
                  onFocus={focusGold} onBlur={blurReset}
                />
                <button
                  type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
                  aria-label={showConfirm ? 'Hide' : 'Show'}
                >
                  <EyeIcon off={showConfirm} />
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className="mt-1 text-[12px] text-[var(--error)]">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 mt-1">
              <input
                id="acceptTerms" type="checkbox" checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-[var(--border-default)] accent-[var(--accent)]"
              />
              <label htmlFor="acceptTerms" className="text-[13px] leading-snug text-[var(--text-secondary)]">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="font-medium text-[var(--accent)] hover:underline">Terms</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="font-medium text-[var(--accent)] hover:underline">Privacy Policy</a>
              </label>
            </div>
            {fieldErrors.acceptTerms && <p className="text-[12px] text-[var(--error)]">{fieldErrors.acceptTerms}</p>}

            {/* Error */}
            {submitError && (
              <div className="rounded-[10px] border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[13px] text-[var(--error)]">
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="btn-shimmer relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-[10px] border-none text-[14px] font-semibold transition-all duration-200 disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--text-on-accent)', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'cp-spin 0.7s linear infinite' }} />
              ) : (
                'Create my workspace'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[13px] text-[var(--text-tertiary)]">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-[var(--accent)] no-underline hover:text-[var(--accent-hover)] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
