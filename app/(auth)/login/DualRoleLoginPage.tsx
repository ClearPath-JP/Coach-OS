'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DevAuthToolbar } from '@/components/auth/DevAuthToolbar'

type LoginRole = 'coach' | 'student'

function isSafeNext(next: string | null): next is string {
  if (!next || typeof next !== 'string') return false
  try {
    const path = new URL(next, 'http://localhost').pathname
    if (path === '/' || path === '/client/portal') return true
    return (
      path.startsWith('/coach/') ||
      path.startsWith('/client/') ||
      path.startsWith('/onboarding') ||
      path === '/billing' ||
      path.startsWith('/admin/')
    )
  } catch {
    return false
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

const ROLE_CONTENT = {
  coach: {
    greeting: 'Welcome back',
    subtext: 'Sign in to your coach workspace.',
    btnLabel: 'Sign in as Coach',
    btnVar: 'var(--cp-role-coach)',
    tabActive: 'var(--cp-role-coach)',
    switchText: 'Are you a student?',
    switchLink: 'Sign in here →',
    switchRole: 'student' as const,
    redirectTo: '/',
    leftHeadline: 'Less admin. More coaching.',
    leftSub: 'One calm home for clients, sessions, programs, and revenue.',
    bullets: [
      'See everyone and everything in one place',
      'A client portal that matches your brand',
      'Room to grow — without the spreadsheet chaos',
      'Private, secure, built for pros like you',
    ],
  },
  student: {
    greeting: 'Hello',
    subtext: 'Sign in to your client portal.',
    btnLabel: 'Sign in to my portal',
    btnVar: 'var(--cp-role-student)',
    tabActive: 'var(--cp-role-student)',
    switchText: 'Are you a coach?',
    switchLink: 'Sign in here →',
    switchRole: 'coach' as const,
    redirectTo: '/client/portal',
    leftHeadline: 'Your coaching, in one place.',
    leftSub: 'Notes, goals, sessions, and resources — no noise.',
    bullets: [
      'Session notes when you need them',
      'Goals you can actually track',
      "Book and see what's next, fast",
      'Warm, simple, and yours',
    ],
  },
} as const

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
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

/**
 * Coach + student dual-role login (design system Phase 2). API maps student → client intent.
 */
export function DualRoleLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')

  const [role, setRole] = useState<LoginRole>('coach')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [googleNotice, setGoogleNotice] = useState(false)

  const emailInvalid = emailTouched && email.trim().length > 0 && !isValidEmail(email)

  useEffect(() => {
    const root = document.documentElement
    const prevTheme = root.getAttribute('data-theme')
    root.setAttribute('data-theme', 'light')
    return () => {
      if (prevTheme != null) {
        root.setAttribute('data-theme', prevTheme)
      } else {
        root.removeAttribute('data-theme')
      }
    }
  }, [])

  const rateLimitMessage =
    searchParams.get('error') === 'rate_limit'
      ? 'Too many failed sign-in attempts. Please try again in 15 minutes.'
      : null
  const passwordResetMessage =
    searchParams.get('message') === 'password_reset'
      ? 'Your password has been updated. Sign in with your new password.'
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailTouched(true)
    if (!isValidEmail(email)) {
      return
    }
    setLoading(true)
    const intent = role === 'coach' ? 'coach' : 'client'
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, intent }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setLoading(false)
    if (!res.ok) {
      if (res.status === 429) {
        setError('Too many attempts — please wait a minute and try again.')
      } else if (res.status === 401) {
        setError('Incorrect email or password. Please try again.')
      } else if (typeof json.error === 'string' && json.error.length > 0) {
        setError(json.error)
      } else {
        setError('Incorrect email or password. Please try again.')
      }
      return
    }
    const defaultPath = role === 'coach' ? ROLE_CONTENT.coach.redirectTo : ROLE_CONTENT.student.redirectTo
    const dest = isSafeNext(nextParam) ? nextParam : defaultPath
    router.push(dest)
    router.refresh()
  }

  async function handleGoogleClick() {
    setGoogleNotice(false)
    setError(null)
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${ROLE_CONTENT[role].redirectTo}`,
        },
      })
      if (oauthError) {
        setGoogleNotice(true)
      }
    } catch {
      setGoogleNotice(true)
    }
  }

  const rc = ROLE_CONTENT[role]

  return (
    <div
      className="box-border flex min-h-[100dvh] w-full max-w-[100vw] lg:h-[100dvh] lg:overflow-hidden"
      style={{
        fontFamily: 'var(--font-dm-sans), var(--font)',
      }}
    >
      <main
        id="login-main"
        className="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:grid lg:h-full lg:grid-cols-2 lg:grid-rows-1"
        aria-labelledby="login-heading"
      >
        {/* Left panel — 50% width; content centered with same max width as form */}
        <div
          className="cp-login-left hidden min-h-0 min-w-0 flex-col overflow-y-auto bg-[var(--cp-navy)] lg:flex lg:h-full lg:flex-col"
          style={{
            padding: 'clamp(20px, 4dvh, 48px) clamp(16px, 5vw, 56px)',
          }}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-[min(480px,100%)] flex-1 flex-col justify-between">
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--cp-white)' }}>
              ClearPath{' '}
              <span style={{ color: 'var(--cp-sky)', fontWeight: 300 }}>Solutions</span>
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 8,
                background: 'color-mix(in srgb, var(--cp-sky) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--cp-sky) 25%, transparent)',
                color: 'var(--cp-sky)',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 20,
                padding: '3px 10px',
                letterSpacing: '0.05em',
              }}
            >
              Coaching OS
            </div>
          </div>

          <div className="min-h-0 flex-1 py-8 lg:py-10">
            <h2
              style={{
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 800,
                color: 'var(--cp-white)',
                lineHeight: 1.12,
                marginBottom: 18,
                letterSpacing: '-0.02em',
              }}
            >
              {rc.leftHeadline}
            </h2>
            <p
              style={{
                fontSize: 'clamp(16px, 1.9vw, 20px)',
                color: 'color-mix(in srgb, var(--cp-nav-text) 92%, transparent)',
                lineHeight: 1.45,
                marginBottom: 28,
                maxWidth: '100%',
                fontWeight: 500,
              }}
            >
              {rc.leftSub}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {rc.bullets.map((bullet) => (
                <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: 'color-mix(in srgb, var(--cp-sky) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--cp-sky) 22%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'var(--cp-sky)',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 'clamp(15px, 1.65vw, 18px)',
                      lineHeight: 1.35,
                      fontWeight: 500,
                      color: 'color-mix(in srgb, var(--cp-white) 88%, var(--cp-gray))',
                    }}
                  >
                    {bullet}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid color-mix(in srgb, var(--cp-white) 8%, transparent)',
              paddingTop: 18,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: 'var(--cp-gray)',
                fontWeight: 700,
                letterSpacing: '0.07em',
                marginBottom: 10,
              }}
            >
              TRUSTED BY
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex' }}>
                {(['JM', 'SR', 'AL', 'KP'] as const).map((initials, i) => (
                  <div
                    key={initials}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: i % 2 === 0 ? 'var(--cp-sapphire)' : 'var(--cp-royal)',
                      border: '2px solid var(--cp-navy)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--cp-lavender)',
                      marginLeft: i === 0 ? 0 : -8,
                      zIndex: 4 - i,
                    }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--cp-gray)' }}>2,400+ coaches</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warning)' }}>
              ★★★★★ <span style={{ color: 'var(--cp-gray)' }}>4.9 / 5</span>
            </div>
          </div>
          </div>
        </div>

        {/* Right panel — 50% width; form block matches left column width */}
        <div
          className="cp-login-right flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto lg:h-full lg:flex-none lg:border-l lg:border-[var(--cp-border)]"
          style={{
            background: 'var(--cp-white)',
            padding: 'clamp(20px, 4dvh, 48px) clamp(16px, 5vw, 56px)',
          }}
        >
          <div className="flex w-full max-w-[min(480px,100%)] flex-col">
          {process.env.NODE_ENV === 'development' ? (
            <div style={{ marginBottom: 20 }}>
              <DevAuthToolbar />
            </div>
          ) : null}

          {rateLimitMessage ? (
            <div
              role="alert"
              aria-live="polite"
              style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--error)',
              }}
            >
              {rateLimitMessage}
            </div>
          ) : null}

          {passwordResetMessage && !rateLimitMessage ? (
            <p
              role="status"
              aria-live="polite"
              style={{
                marginBottom: 16,
                borderRadius: 8,
                border: `1px solid color-mix(in srgb, var(--cp-sapphire) 35%, var(--cp-border))`,
                background: 'var(--info-bg)',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.45,
                color: 'var(--cp-sapphire)',
              }}
            >
              {passwordResetMessage}
            </p>
          ) : null}

          <div style={{ marginBottom: 24 }}>
            <h1 id="login-heading" style={{ fontSize: 24, fontWeight: 800, color: 'var(--cp-navy)', margin: 0 }}>
              {rc.greeting}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--cp-gray)', marginTop: 4 }}>{rc.subtext}</div>
          </div>

          <div
            style={{
              display: 'flex',
              background: 'var(--bg-muted)',
              borderRadius: 10,
              padding: 3,
              gap: 3,
              marginBottom: 24,
            }}
          >
            {(['coach', 'student'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r)
                  setError(null)
                }}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: role === r ? ROLE_CONTENT[r].tabActive : 'transparent',
                  color: role === r ? 'var(--cp-white)' : 'var(--cp-gray)',
                }}
              >
                {r === 'coach' ? 'Coach' : 'Student'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleClick()}
            disabled={loading}
            style={{
              width: '100%',
              height: 44,
              border: '1.5px solid var(--cp-border)',
              borderRadius: 10,
              background: 'var(--cp-white)',
              color: 'var(--cp-text)',
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 16,
              opacity: loading ? 0.65 : 1,
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={(e) => {
              if (loading) return
              e.currentTarget.style.background = 'var(--bg-subtle)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--cp-white)'
              e.currentTarget.style.borderColor = 'var(--cp-border)'
            }}
          >
            <GoogleMark />
            Continue with Google
          </button>
          {googleNotice ? (
            <p
              id="login-google-hint"
              role="status"
              style={{ marginTop: -8, marginBottom: 16, textAlign: 'center', fontSize: 12, color: 'var(--cp-gray)' }}
            >
              Google sign-in is not set up for this app yet. Use your email and password below.
            </p>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--cp-border)' }} />
            <span style={{ fontSize: 12, color: 'var(--cp-nav-text)' }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--cp-border)' }} />
          </div>

          {error ? (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--error)',
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="login-email"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cp-text)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'coach' ? 'coach@example.com' : 'you@example.com'}
                disabled={loading}
                aria-invalid={emailInvalid}
                aria-describedby={emailInvalid ? 'login-email-error' : undefined}
                style={{
                  width: '100%',
                  height: 44,
                  border: `1.5px solid ${emailInvalid ? 'var(--error)' : 'var(--cp-input-border)'}`,
                  borderRadius: 10,
                  padding: '0 14px',
                  fontSize: 14,
                  color: 'var(--cp-navy)',
                  background: 'var(--cp-white)',
                  outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  if (!emailInvalid) {
                    e.target.style.borderColor = 'var(--cp-input-focus)'
                    e.target.style.boxShadow = '0 0 0 3px var(--cp-focus-ring)'
                  }
                }}
                onBlur={(e) => {
                  setEmailTouched(true)
                  const v = e.target.value
                  const invalid = v.trim().length > 0 && !isValidEmail(v)
                  e.target.style.borderColor = invalid ? 'var(--error)' : 'var(--cp-input-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              {emailInvalid ? (
                <p id="login-email-error" style={{ marginTop: 6, fontSize: 12, color: 'var(--error)' }} role="alert">
                  Enter a valid email address.
                </p>
              ) : null}
            </div>

            <div style={{ marginBottom: 6 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <label htmlFor="login-password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cp-text)' }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  tabIndex={loading ? -1 : 0}
                  style={{
                    fontSize: 12,
                    color: 'var(--cp-sapphire)',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 44,
                    border: '1.5px solid var(--cp-input-border)',
                    borderRadius: 10,
                    padding: '0 42px 0 14px',
                    fontSize: 14,
                    color: 'var(--cp-navy)',
                    background: 'var(--cp-white)',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--cp-input-focus)'
                    e.target.style.boxShadow = '0 0 0 3px var(--cp-focus-ring)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--cp-input-border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={loading}
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--cp-gray)',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              style={{
                width: '100%',
                height: 46,
                marginTop: 20,
                background: loading ? 'var(--cp-gray)' : rc.btnVar,
                color: 'var(--cp-white)',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {loading ? (
                <>
                  <span
                    className="cp-login-spinner inline-block size-4 shrink-0 rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  Signing in...
                </>
              ) : (
                rc.btnLabel
              )}
            </button>
          </form>

          <div style={{ marginTop: 32, paddingTop: 8, textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                marginBottom: 12,
              }}
            >
              <svg width="12" height="12" fill="none" stroke="var(--cp-nav-text)" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontSize: 11, color: 'var(--cp-nav-text)' }}>Encrypted & secure</span>
            </div>

            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--cp-gray)' }}>{rc.switchText} </span>
              <button
                type="button"
                onClick={() => {
                  setRole(rc.switchRole)
                  setError(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--cp-sapphire)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {rc.switchLink}
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--cp-gray)', marginBottom: 6 }}>
              New to ClearPath?{' '}
              <Link href="/signup" style={{ color: 'var(--cp-sapphire)', fontWeight: 600, textDecoration: 'none' }}>
                Get started →
              </Link>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-placeholder)' }}>
              <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>
                Terms of Service
              </Link>
              {' · '}
              <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>
                Privacy Policy
              </Link>
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}
