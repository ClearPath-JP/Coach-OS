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
type ViewState = 'select' | 'form'

/* ───────────────── Dawn Dojo Canvas — calm dust motes only ───────────────── */

function DawnDojoCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = window.innerWidth
    let h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const sizeCanvas = () => {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    sizeCanvas()

    const handleResize = () => {
      w = window.innerWidth
      h = window.innerHeight
      sizeCanvas()
    }
    window.addEventListener('resize', handleResize, { passive: true })

    type Mote = {
      x: number; y: number; r: number; speed: number
      drift: number; phase: number; opacity: number
    }

    function spawnMote(initial = false): Mote {
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + Math.random() * 40,
        r: 0.5 + Math.random() * 1.4,
        speed: 0.08 + Math.random() * 0.25,
        drift: (Math.random() - 0.5) * 0.15,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.15 + Math.random() * 0.35,
      }
    }

    const motes: Mote[] = Array.from({ length: 22 }, () => spawnMote(true))

    let animId: number
    let last = 0
    let hidden = false
    const onVis = () => { hidden = document.hidden }
    document.addEventListener('visibilitychange', onVis)

    function draw(t: number) {
      animId = requestAnimationFrame(draw)
      if (hidden) return
      if (t - last < 33) return
      last = t

      ctx!.clearRect(0, 0, w, h)

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i]
        if (!m) continue
        m.y -= m.speed
        m.x += m.drift + Math.sin(t * 0.0006 + m.phase) * 0.2

        if (m.y < -10) { motes[i] = spawnMote(); continue }

        const glowR = m.r * 4
        const grad = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, glowR)
        grad.addColorStop(0, `rgba(245, 230, 200, ${m.opacity * 0.25})`)
        grad.addColorStop(1, 'rgba(245, 230, 200, 0)')
        ctx!.fillStyle = grad
        ctx!.fillRect(m.x - glowR, m.y - glowR, glowR * 2, glowR * 2)

        ctx!.beginPath()
        ctx!.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(248, 238, 215, ${m.opacity})`
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

/* ───────────────── SVG Icons ───────────────── */

/** Katana icon for Coach role */
function KatanaIcon({ glow }: { glow?: boolean }) {
  return (
    <svg viewBox="0 0 64 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 58, height: 108 }}>
      <defs>
        <linearGradient id="katana-blade" x1="32" y1="8" x2="32" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={glow ? 'rgba(240,230,200,0.9)' : 'rgba(214,208,192,0.78)'} />
          <stop offset="100%" stopColor={glow ? 'rgba(180,170,140,0.7)' : 'rgba(165,158,138,0.55)'} />
        </linearGradient>
        {glow && (
          <filter id="katana-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>
      {/* Blade */}
      <path
        d="M31 8 L33 8 L34 75 L30 75 Z"
        fill="url(#katana-blade)"
        stroke={glow ? 'rgba(var(--accent-rgb),0.3)' : 'rgba(195,180,155,0.32)'}
        strokeWidth="0.5"
        filter={glow ? 'url(#katana-glow)' : undefined}
      />
      {/* Tsuba */}
      <ellipse cx="32" cy="78" rx="10" ry="3" fill={glow ? 'rgba(180,150,80,0.6)' : 'rgba(155,128,72,0.6)'} />
      {/* Handle */}
      <rect x="29" y="81" width="6" height="28" rx="1.5" fill={glow ? 'rgba(60,45,25,0.8)' : 'rgba(72,56,34,0.72)'} />
      {[0, 6, 12, 18, 24].map((y) => (
        <line key={y} x1="29" y1={83 + y} x2="35" y2={86 + y} stroke={glow ? 'rgba(160,130,70,0.35)' : 'rgba(150,122,68,0.34)'} strokeWidth="0.6" />
      ))}
      {/* Pommel */}
      <ellipse cx="32" cy="111" rx="4.5" ry="2" fill={glow ? 'rgba(160,130,70,0.5)' : 'rgba(135,108,66,0.54)'} />
    </svg>
  )
}

/** Torii gate icon for Student role */
function StudentIcon({ glow }: { glow?: boolean }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 68, height: 68 }}>
      <defs>
        {glow && (
          <filter id="student-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>
      {/* Torii gate shape — symbolizing the student entering the path */}
      <g filter={glow ? 'url(#student-glow)' : undefined}>
        {/* Top beam */}
        <path
          d="M15 22 L65 22 L67 18 L13 18 Z"
          fill={glow ? 'rgba(var(--accent-rgb),0.6)' : 'rgba(198,172,128,0.6)'}
        />
        {/* Secondary beam */}
        <rect x="18" y="26" width="44" height="3" rx="1" fill={glow ? 'rgba(200,160,80,0.45)' : 'rgba(170,146,100,0.46)'} />
        {/* Left pillar */}
        <rect x="22" y="26" width="4" height="42" fill={glow ? 'rgba(200,160,80,0.45)' : 'rgba(170,146,100,0.46)'} />
        {/* Right pillar */}
        <rect x="54" y="26" width="4" height="42" fill={glow ? 'rgba(200,160,80,0.45)' : 'rgba(170,146,100,0.46)'} />
        {/* Base left */}
        <rect x="18" y="66" width="12" height="3" rx="1" fill={glow ? 'rgba(200,160,80,0.35)' : 'rgba(170,146,100,0.4)'} />
        {/* Base right */}
        <rect x="50" y="66" width="12" height="3" rx="1" fill={glow ? 'rgba(200,160,80,0.35)' : 'rgba(170,146,100,0.4)'} />
      </g>
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

/* ───────────────── Role Select Screen ───────────────── */

const VALUE_BULLETS = ['Your classes', 'Payments', 'Videos', 'Schedule']

function RoleSelect({ onSelect }: { onSelect: (role: LoginRole) => void }) {
  const [hovered, setHovered] = useState<LoginRole | null>(null)

  const cardStyle = (r: LoginRole): React.CSSProperties => ({
    background: hovered === r ? 'rgba(12,12,15,0.78)' : 'rgba(12,12,15,0.66)',
    backdropFilter: 'blur(24px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
    border: `1px solid ${hovered === r ? 'rgba(var(--accent-rgb),0.6)' : 'rgba(var(--accent-rgb),0.4)'}`,
    borderRadius: 18,
    padding: '40px 32px 30px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    transition: 'all 0.35s ease',
    transform: hovered === r ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
    boxShadow: hovered === r
      ? '0 0 50px rgba(var(--accent-rgb),0.18), 0 14px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 10px 36px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)',
    width: 'clamp(180px, 22vw, 230px)',
  })

  const labelStyle = (r: LoginRole): React.CSSProperties => ({
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: '0.1em',
    color: hovered === r ? 'var(--accent-hover)' : 'rgba(230,225,215,0.9)',
    transition: 'color 0.3s, text-shadow 0.3s',
    textShadow: hovered === r ? '0 0 16px rgba(var(--accent-rgb),0.4)' : '0 1px 6px rgba(0,0,0,0.5)',
    display: 'block',
  })

  const subLabelStyle = (r: LoginRole): React.CSSProperties => ({
    fontSize: 11,
    color: hovered === r ? 'rgba(210,200,180,0.7)' : 'rgba(200,190,170,0.5)',
    transition: 'color 0.3s',
    letterSpacing: '0.04em',
    marginTop: 6,
    display: 'block',
  })

  return (
    <div
      className="relative z-10"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        padding: '0 20px',
        animation: 'gameMenuAppear 0.8s ease-out both',
        animationDelay: '0.3s',
      }}
    >
      {/* Headline — what Korva is, in one line */}
      <h1
        className="role-headline"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(20px, 3vw, 28px)',
          fontWeight: 500,
          letterSpacing: '0.01em',
          color: 'rgba(240,237,232,0.92)',
          textShadow: '0 2px 18px rgba(0,0,0,0.6)',
          margin: 0,
          textAlign: 'center',
        }}
      >
        Run your whole coaching business.
      </h1>

      {/* Two role cards */}
      <div className="role-cards" style={{ display: 'flex', gap: 'clamp(20px, 4vw, 48px)', alignItems: 'center' }}>
        {/* Coach card */}
        <button
          type="button"
          className="role-card"
          onClick={() => onSelect('coach')}
          onMouseEnter={() => setHovered('coach')}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle('coach')}
          aria-label="Sign in as a coach"
        >
          <div className="role-icon-slot" style={{ height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KatanaIcon glow={hovered === 'coach'} />
          </div>
          <div
            aria-hidden
            style={{ width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${hovered === 'coach' ? 'rgba(var(--accent-rgb),0.3)' : 'rgba(200,170,100,0.12)'}, transparent)` }}
          />
          <div style={{ textAlign: 'center' }}>
            <span style={labelStyle('coach')}>COACH</span>
            <span style={subLabelStyle('coach')}>Your dojo</span>
          </div>
        </button>

        {/* Decorative divider */}
        <div className="role-divider" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div className="role-divider-line" style={{ width: 1, height: 50, background: 'linear-gradient(180deg, transparent, rgba(200,170,100,0.2), transparent)' }} />
          <span style={{ fontSize: 10, color: 'rgba(200,190,170,0.25)', letterSpacing: '0.12em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>OR</span>
          <div className="role-divider-line" style={{ width: 1, height: 50, background: 'linear-gradient(180deg, transparent, rgba(200,170,100,0.2), transparent)' }} />
        </div>

        {/* Student card */}
        <button
          type="button"
          className="role-card"
          onClick={() => onSelect('student')}
          onMouseEnter={() => setHovered('student')}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle('student')}
          aria-label="Sign in as a student"
        >
          <div className="role-icon-slot" style={{ height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StudentIcon glow={hovered === 'student'} />
          </div>
          <div
            aria-hidden
            style={{ width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${hovered === 'student' ? 'rgba(var(--accent-rgb),0.3)' : 'rgba(200,170,100,0.12)'}, transparent)` }}
          />
          <div style={{ textAlign: 'center' }}>
            <span style={labelStyle('student')}>STUDENT</span>
            <span style={subLabelStyle('student')}>Your training</span>
          </div>
        </button>
      </div>

      {/* Value micro-bullets — what every coach owns */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(8px, 2vw, 14px)',
          maxWidth: 440,
        }}
      >
        {VALUE_BULLETS.map((t, i) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)' }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(230,221,202,0.85)',
                textShadow: '0 1px 8px rgba(0,0,0,0.85)',
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </span>
            {i < VALUE_BULLETS.length - 1 && (
              <span aria-hidden style={{ color: 'rgba(var(--accent-rgb),0.55)', fontSize: 12, lineHeight: 1 }}>·</span>
            )}
          </span>
        ))}
      </div>

      {/* Signup link — coaches only (students are invited by their coach) */}
      <p style={{ fontSize: 13, color: 'rgba(212,202,184,0.7)', margin: 0, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
        New coach?{' '}
        <Link
          href="/signup"
          style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
        >
          Open your dojo
        </Link>
      </p>

      {/* Founder credibility */}
      <p
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'rgba(214,204,186,0.72)',
          textShadow: '0 1px 8px rgba(0,0,0,0.8)',
          margin: 0,
        }}
      >
        Built by a coach, for coaches.
      </p>
    </div>
  )
}

/* ───────────────── Login Form Card ───────────────── */

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
    <div
      className="relative z-10 w-full max-w-[400px] mx-4"
      style={{ animation: 'formSlideIn 0.5s ease-out both' }}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(200,190,170,0.55)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
          padding: '4px 0',
          transition: 'color 0.2s',
          letterSpacing: '0.03em',
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(200,190,170,0.55)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Glass card */}
      <div
        style={{
          background: 'rgba(8, 8, 10, 0.72)',
          backdropFilter: 'blur(28px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
          border: '1px solid rgba(200, 170, 100, 0.14)',
          borderRadius: 16,
          padding: '32px 28px 28px',
          boxShadow: '0 0 60px rgba(200, 120, 40, 0.05), 0 20px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '0.02em',
              color: 'rgba(240,237,232,0.9)',
              margin: 0,
            }}
          >
            {isSensei ? 'Welcome back to your dojo' : 'Enter the Dojo'}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(200,190,170,0.55)', marginTop: 6, letterSpacing: '0.02em' }}>
            {isSensei ? 'Sign in to your coaching workspace.' : 'Sign in to your training portal.'}
          </p>
        </div>

        {/* Decorative line */}
        <div aria-hidden style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,170,100,0.15), transparent)', marginBottom: 22 }} />

        {/* Alerts */}
        {rateLimitMessage && (
          <div role="alert" style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(180,40,40,0.15)', border: '1px solid rgba(180,40,40,0.25)', color: '#f87171' }}>
            {rateLimitMessage}
          </div>
        )}
        {passwordResetMessage && !rateLimitMessage && (
          <div role="status" style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(40,140,80,0.15)', border: '1px solid rgba(40,140,80,0.25)', color: '#4ade80' }}>
            {passwordResetMessage}
          </div>
        )}
        {verifyEmailMessage && !rateLimitMessage && !passwordResetMessage && (
          <div role="status" style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(40,140,80,0.15)', border: '1px solid rgba(40,140,80,0.25)', color: '#4ade80' }}>
            {verifyEmailMessage}
          </div>
        )}

        {/* Form — method=post is a no-JS safety net; submit is always intercepted below */}
        <form method="post" onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          {/* Email */}
          <div>
            <label htmlFor="login-email" style={{ display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(200,190,170,0.55)' }}>
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
              style={{
                width: '100%', height: 46, borderRadius: 10,
                border: emailError ? '1px solid rgba(220,60,60,0.5)' : '1px solid rgba(200,170,100,0.08)',
                background: 'rgba(255,255,255,0.035)', padding: '0 14px', fontSize: 14,
                color: 'rgba(240,237,232,0.9)', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' as const,
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(200,150,60,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,150,60,0.08)' }}
              onBlurCapture={(e) => { e.target.style.borderColor = emailError ? 'rgba(220,60,60,0.5)' : 'rgba(200,170,100,0.08)'; e.target.style.boxShadow = 'none' }}
            />
            {emailError && <p style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>{emailError}</p>}
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label htmlFor="login-password" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(200,190,170,0.55)' }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                aria-invalid={passwordError ? true : undefined}
                style={{
                  width: '100%', height: 46, borderRadius: 10,
                  border: passwordError ? '1px solid rgba(220,60,60,0.5)' : '1px solid rgba(200,170,100,0.08)',
                  background: 'rgba(255,255,255,0.035)', padding: '0 42px 0 14px', fontSize: 14,
                  color: 'rgba(240,237,232,0.9)', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' as const,
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(200,150,60,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,150,60,0.08)' }}
                onBlur={(e) => { e.target.style.borderColor = passwordError ? 'rgba(220,60,60,0.5)' : 'rgba(200,170,100,0.08)'; e.target.style.boxShadow = 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,190,170,0.3)', padding: 0, transition: 'color 0.15s' }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(200,190,170,0.55)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(200,190,170,0.3)' }}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
            {passwordError && <p style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>{passwordError}</p>}
          </div>

          {/* Error */}
          {error && (
            <p role="alert" style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(180,40,40,0.12)', border: '1px solid rgba(180,40,40,0.2)', color: '#f87171', margin: 0 }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="login-enter-btn"
            style={{
              marginTop: 8, height: 48, width: '100%', borderRadius: 10,
              border: '1px solid rgba(240,182,92,0.5)',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
              color: '#160f06', fontSize: 14, fontWeight: 600, letterSpacing: '0.05em',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 18px rgba(200,140,40,0.25)',
            }}
          >
            {loading ? (
              <div style={{ width: 18, height: 18, border: '2px solid rgba(20,14,6,0.25)', borderTopColor: '#160f06', borderRadius: '50%', animation: 'gameMenuSpin 0.7s linear infinite', margin: '0 auto' }} />
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Divider */}
        <div aria-hidden style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,170,100,0.12), transparent)', margin: '20px 0 16px' }} />

        {/* Footer — coaches sign up; students are invited by their coach */}
        <div style={{ textAlign: 'center' }}>
          {isSensei ? (
            <p style={{ fontSize: 13, color: 'rgba(200,190,170,0.5)', margin: 0 }}>
              New here?{' '}
              <Link
                href="/signup"
                style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
              >
                Open your dojo
              </Link>
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(200,190,170,0.5)', margin: 0 }}>
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
    <div
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{ fontFamily: 'var(--font-dm-sans), var(--font)' }}
    >
      {/* ═══ FULL-SCREEN HERO IMAGE ═══ */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(/images/newlogin.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Soft overlay — lets the warm dojo light breathe through */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(8,8,10,0.35) 0%, rgba(8,8,10,0.18) 45%, rgba(5,5,8,0.45) 100%)' }} />

      {/* Subtle vignette */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)' }} />

      {/* ═══ DUST MOTES ═══ */}
      <DawnDojoCanvas />

      {/* ═══ TOP BAR ═══ */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(240,237,232,0.95)', lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
          KOR<span style={{ color: 'var(--accent)' }}>VA</span>
        </div>
        <p className="top-tagline" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(200,190,170,0.5)', textShadow: '0 1px 6px rgba(0,0,0,0.6)', margin: 0 }}>
          FOCUS. TRAIN. EVOLVE.
        </p>
      </div>

      {/* ═══ CONTENT ═══ */}
      {view === 'select' ? (
        <RoleSelect onSelect={handleRoleSelect} />
      ) : (
        <LoginForm role={role} onBack={() => setView('select')} />
      )}

      {/* ═══ BOTTOM LINE ═══ */}
      <div aria-hidden style={{ position: 'absolute', bottom: 20, left: '15%', right: '15%', zIndex: 10, height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,170,100,0.06), transparent)' }} />

      <style>{`
        @keyframes gameMenuSpin { to { transform: rotate(360deg); } }
        @keyframes gameMenuAppear {
          0% { opacity: 0; transform: translateY(16px) scale(0.97); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes formSlideIn {
          0% { opacity: 0; transform: translateY(12px); filter: blur(3px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        #login-email::placeholder,
        #login-password::placeholder {
          color: rgba(200, 190, 170, 0.2);
        }
        .login-enter-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 100%) !important;
          border-color: rgba(245,198,114,0.65) !important;
          box-shadow: 0 6px 26px rgba(200,140,40,0.4) !important;
          transform: translateY(-1px);
        }
        @media (max-width: 600px) {
          .role-cards { flex-direction: column !important; gap: 18px !important; }
          .role-card { width: min(320px, 84vw) !important; padding: 26px 28px 22px !important; }
          .role-divider { flex-direction: row !important; gap: 12px !important; }
          .role-divider-line { width: 44px !important; height: 1px !important; }
        }
        @media (max-width: 480px) {
          .top-tagline { display: none !important; }
          .role-headline { font-size: 20px !important; }
          .role-icon-slot { height: 84px !important; }
        }
      `}</style>
    </div>
  )
}
