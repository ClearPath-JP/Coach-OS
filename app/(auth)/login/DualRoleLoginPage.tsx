'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isSafeAuthRedirectPath, safeRedirectFromNextQuery } from '@/lib/safe-auth-redirect'

/* ───────────────── helpers ───────────────── */

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

type LoginRole = 'coach' | 'student'

/* ───────────────── Wind particles (canvas) ───────────────── */

function WindCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = canvas.parentElement?.clientWidth ?? window.innerWidth / 2
    let h = canvas.parentElement?.clientHeight ?? window.innerHeight
    canvas.width = w
    canvas.height = h

    const handleResize = () => {
      w = canvas.parentElement?.clientWidth ?? window.innerWidth / 2
      h = canvas.parentElement?.clientHeight ?? window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    window.addEventListener('resize', handleResize, { passive: true })

    type P = { x: number; y: number; len: number; speed: number; opacity: number; drift: number }
    const particles: P[] = Array.from({ length: 35 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      len: 8 + Math.random() * 20,
      speed: 0.6 + Math.random() * 1.4,
      opacity: 0.03 + Math.random() * 0.08,
      drift: -0.1 + Math.random() * 0.2,
    }))

    // A few embers (tiny warm dots that float up)
    type E = { x: number; y: number; r: number; speed: number; opacity: number; phase: number }
    const embers: E[] = Array.from({ length: 12 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.8 + Math.random() * 1.5,
      speed: 0.2 + Math.random() * 0.5,
      opacity: 0.06 + Math.random() * 0.15,
      phase: Math.random() * Math.PI * 2,
    }))

    let animId: number
    let last = 0
    let hidden = false
    const onVis = () => { hidden = document.hidden }
    document.addEventListener('visibilitychange', onVis)

    function draw(t: number) {
      animId = requestAnimationFrame(draw)
      if (hidden) return
      if (t - last < 33) return // ~30fps
      last = t

      ctx!.clearRect(0, 0, w, h)

      // Wind streaks
      for (const p of particles) {
        p.x += p.speed
        p.y += p.drift
        if (p.x > w + 30) { p.x = -30; p.y = Math.random() * h }
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        ctx!.beginPath()
        ctx!.moveTo(p.x, p.y)
        ctx!.lineTo(p.x - p.len, p.y + p.drift * 4)
        ctx!.strokeStyle = `rgba(200, 190, 170, ${p.opacity})`
        ctx!.lineWidth = 0.5
        ctx!.stroke()
      }

      // Embers
      for (const e of embers) {
        e.y -= e.speed
        e.x += Math.sin(t * 0.001 + e.phase) * 0.3
        if (e.y < -10) { e.y = h + 10; e.x = Math.random() * w }

        const pulse = e.opacity + Math.sin(t * 0.002 + e.phase) * 0.04
        ctx!.beginPath()
        ctx!.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(200, 120, 60, ${Math.max(0, pulse)})`
        ctx!.fill()
      }
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    />
  )
}

/* ───────────────── Katana SVG ───────────────── */

function KatanaSVG() {
  return (
    <svg
      viewBox="0 0 120 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="katana-sway"
      style={{
        width: 60,
        height: 200,
        opacity: 0.35,
        filter: 'drop-shadow(0 0 20px rgba(200,120,60,0.08))',
      }}
      aria-hidden
    >
      {/* Blade */}
      <path
        d="M58 10 L62 10 L63 180 L57 180 Z"
        fill="url(#blade-grad)"
        stroke="rgba(200,190,170,0.15)"
        strokeWidth="0.5"
      />
      {/* Hilt guard (tsuba) */}
      <ellipse cx="60" cy="185" rx="14" ry="4" fill="rgba(140,120,80,0.5)" stroke="rgba(180,160,100,0.3)" strokeWidth="0.5" />
      {/* Grip */}
      <rect x="56" y="189" width="8" height="50" rx="2" fill="rgba(60,50,35,0.7)" stroke="rgba(140,120,80,0.25)" strokeWidth="0.5" />
      {/* Grip wrapping pattern */}
      {[0, 8, 16, 24, 32, 40].map((y) => (
        <line key={y} x1="56" y1={191 + y} x2="64" y2={195 + y} stroke="rgba(140,120,80,0.2)" strokeWidth="0.8" />
      ))}
      {/* Pommel */}
      <ellipse cx="60" cy="242" rx="6" ry="3" fill="rgba(140,120,80,0.4)" />
      <defs>
        <linearGradient id="blade-grad" x1="60" y1="10" x2="60" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(220,215,200,0.6)" />
          <stop offset="100%" stopColor="rgba(160,150,130,0.3)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ───────────────── Eye icon ───────────────── */

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

/* ───────────────── Main component ───────────────── */

export function DualRoleLoginPage() {
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')

  const [role, setRole] = useState<LoginRole>('coach')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)

  const emailInvalid = emailTouched && email.trim().length > 0 && !isValidEmail(email)

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
    if (!isValidEmail(email)) return
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

  return (
    <div className="flex min-h-[100dvh] w-full" style={{ fontFamily: 'var(--font-dm-sans), var(--font)' }}>

      {/* ═══ LEFT PANEL — atmospheric ═══ */}
      <div
        className="relative hidden min-h-0 flex-col overflow-hidden lg:flex lg:w-[50%]"
        style={{ background: '#0A0908' }}
      >
        {/* Grain texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            pointerEvents: 'none',
          }}
        />

        {/* Radial accent glow at bottom */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: '-15%',
            left: '20%',
            width: '70%',
            height: '60%',
            background: 'radial-gradient(ellipse, rgba(159,18,57,0.1) 0%, rgba(180,100,40,0.04) 40%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
        {/* Secondary glow — top right */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-10%',
            width: '50%',
            height: '50%',
            background: 'radial-gradient(ellipse, rgba(159,18,57,0.06) 0%, transparent 60%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        <WindCanvas />

        {/* Content layer */}
        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          {/* Top — brand */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 500,
                letterSpacing: '0.04em',
                color: 'rgba(237,237,239,0.7)',
                lineHeight: 1,
              }}
            >
              SENSEI<span style={{ color: 'var(--accent)' }}> APP</span>
            </div>
          </div>

          {/* Center — Katana + headline */}
          <div className="flex flex-col items-center gap-8">
            <KatanaSVG />
            <div className="text-center">
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  color: 'rgba(240,237,232,0.85)',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Discipline is the path.
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: 'rgba(200,190,170,0.45)',
                  marginTop: 12,
                  letterSpacing: '0.01em',
                  lineHeight: 1.5,
                }}
              >
                The coaching platform for martial arts<br />and strength conditioning.
              </p>
            </div>
          </div>

          {/* Bottom — subtle decorative line */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(200,170,100,0.12), transparent)',
                marginBottom: 16,
              }}
            />
            <p style={{ fontSize: 11, color: 'rgba(200,190,170,0.25)', letterSpacing: '0.06em' }}>
              Focus. Train. Evolve.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — form ═══ */}
      <div
        className="flex min-h-[100dvh] w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 lg:min-h-0 lg:w-[50%] lg:px-12"
        style={{ background: 'var(--bg-app)' }}
      >
        {/* Glass card wrapper */}
        <div
          className="glass-modal w-full max-w-[440px] rounded-2xl p-8 lg:p-10"
          style={{
            background: 'rgba(24,24,27,0.5)',
            border: '1px solid rgba(159,18,57,0.12)',
            boxShadow: '0 0 60px rgba(159,18,57,0.06), 0 8px 32px rgba(0,0,0,0.3)',
          }}
        >

          {/* Mobile-only brand mark */}
          <div className="mb-8 text-center lg:hidden">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              SENSEI<span style={{ color: 'var(--accent)' }}> APP</span>
            </div>
          </div>

          {/* Alerts */}
          {rateLimitMessage && (
            <div
              role="alert"
              className="mb-4 rounded-[10px] border px-4 py-3 text-[13px]"
              style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)', color: 'var(--error)' }}
            >
              {rateLimitMessage}
            </div>
          )}
          {passwordResetMessage && !rateLimitMessage && (
            <div
              role="status"
              className="mb-4 rounded-[10px] border px-4 py-3 text-[13px]"
              style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success)' }}
            >
              {passwordResetMessage}
            </div>
          )}

          {/* Heading */}
          <div className="mb-8">
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: '0.01em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {role === 'coach' ? 'Welcome back' : 'Sign in'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {role === 'coach' ? 'Sign in to your coaching workspace.' : 'Sign in to your client portal.'}
            </p>
          </div>

          {/* Role toggle */}
          <div
            className="mb-6 flex rounded-[10px] p-1"
            style={{ background: 'var(--bg-muted)' }}
          >
            {(['coach', 'student'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setError(null) }}
                className="flex-1 rounded-[8px] py-2 text-center text-[13px] font-medium transition-all duration-200"
                style={{
                  background: role === r ? 'var(--bg-subtle)' : 'transparent',
                  color: role === r ? 'var(--accent)' : 'var(--text-tertiary)',
                  boxShadow: role === r ? '0 1px 3px rgba(0,0,0,0.3), 0 0 8px rgba(159,18,57,0.08)' : 'none',
                  borderBottom: role === r ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {r === 'coach' ? 'Coach' : 'Client'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
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
                className="h-11 w-full rounded-[10px] border bg-[var(--bg-subtle)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-quaternary)]"
                style={{
                  borderColor: emailInvalid ? 'var(--error)' : 'var(--border-default)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(159,18,57,0.15)'
                }}
                onBlurCapture={(e) => {
                  e.target.style.borderColor = emailInvalid ? 'var(--error)' : 'var(--border-default)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              {emailInvalid && (
                <p className="mt-1 text-[12px] text-[var(--error)]">Enter a valid email address.</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] text-[var(--text-tertiary)] no-underline transition-colors duration-150 hover:text-[var(--accent)] hover:underline"
                  tabIndex={-1}
                >
                  Forgot?
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
                  className="h-11 w-full rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 pr-11 text-[14px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-quaternary)]"
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(159,18,57,0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-default)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)] transition-colors duration-150 hover:text-[var(--text-secondary)]"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p role="alert" className="rounded-[8px] border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-[13px] text-[var(--error)]">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-shimmer relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-[10px] border-none text-[14px] font-semibold transition-all duration-200 disabled:opacity-60"
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
                'Sign in'
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-8 text-center">
            <p className="text-[13px] text-[var(--text-tertiary)]">
              New here?{' '}
              <Link
                href="/signup"
                className="font-medium text-[var(--accent)] no-underline transition-colors duration-150 hover:text-[var(--accent-hover)] hover:underline"
              >
                Create your coaching workspace
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cp-spin { to { transform: rotate(360deg); } }
        @keyframes katanaSway {
          0%, 100% { transform: rotate(-0.3deg); }
          50% { transform: rotate(0.3deg); }
        }
        .katana-sway {
          animation: katanaSway 6s ease-in-out infinite;
          transform-origin: bottom center;
        }
      `}</style>
    </div>
  )
}
