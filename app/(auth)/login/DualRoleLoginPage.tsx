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

/* ───────────────── Cinematic Canvas Overlay ───────────────── */

function CinematicCanvas() {
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
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.scale(dpr, dpr)

    const handleResize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    window.addEventListener('resize', handleResize, { passive: true })

    /* ── Fire zone — matched to the campfire in the image ── */
    const fireX = () => w * 0.53
    const fireY = () => h * 0.48

    /* ── Embers — rise from fire zone ── */
    type Ember = {
      x: number; y: number; r: number; speed: number
      opacity: number; phase: number; life: number; maxLife: number
      drift: number; color: [number, number, number]
    }

    function spawnEmber(): Ember {
      const angle = (Math.random() - 0.5) * 0.8
      return {
        x: fireX() + (Math.random() - 0.5) * w * 0.08,
        y: fireY() + (Math.random() - 0.5) * h * 0.04,
        r: 0.6 + Math.random() * 2,
        speed: 0.25 + Math.random() * 0.7,
        opacity: 0.35 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        life: 0,
        maxLife: 200 + Math.random() * 300,
        drift: Math.sin(angle) * 0.35,
        color: Math.random() > 0.35
          ? [255, 130 + Math.random() * 70, 20 + Math.random() * 40]
          : [255, 190 + Math.random() * 55, 60 + Math.random() * 50],
      }
    }

    const embers: Ember[] = Array.from({ length: 50 }, spawnEmber)

    /* ── Fireflies — glow in the grass (lower 40%) ── */
    type Firefly = {
      x: number; y: number; baseX: number; baseY: number
      r: number; phase: number; speed: number; brightness: number
    }

    const fireflies: Firefly[] = Array.from({ length: 22 }, () => {
      const x = Math.random() * w
      const y = h * 0.6 + Math.random() * h * 0.35
      return {
        x, y, baseX: x, baseY: y,
        r: 1 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.6,
        brightness: 0.15 + Math.random() * 0.4,
      }
    })

    /* ── Floating ash ── */
    type Ash = {
      x: number; y: number; r: number; speed: number
      opacity: number; rotation: number; rotSpeed: number; phase: number
    }

    const ashes: Ash[] = Array.from({ length: 12 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 2,
      speed: 0.08 + Math.random() * 0.2,
      opacity: 0.04 + Math.random() * 0.08,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.015,
      phase: Math.random() * Math.PI * 2,
    }))

    /* ── Fog layers ── */
    type Fog = { x: number; y: number; width: number; height: number; speed: number; opacity: number }

    const fogLayers: Fog[] = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * w * 2 - w * 0.5,
      y: h * 0.18 + (i / 5) * h * 0.35,
      width: w * 0.5 + Math.random() * w * 0.4,
      height: h * 0.06 + Math.random() * h * 0.05,
      speed: 0.06 + Math.random() * 0.12,
      opacity: 0.012 + Math.random() * 0.02,
    }))

    /* ── Grass blades — animated SVG-style blades at the bottom ── */
    type Blade = {
      x: number; baseY: number; height: number; width: number
      phase: number; swayAmount: number; color: string
    }

    const grassBlades: Blade[] = Array.from({ length: 80 }, () => {
      const brightness = 20 + Math.random() * 40
      const greenShift = Math.random() > 0.5
      return {
        x: Math.random() * w,
        baseY: h * 0.78 + Math.random() * h * 0.22,
        height: 12 + Math.random() * 35,
        width: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        swayAmount: 2 + Math.random() * 5,
        color: greenShift
          ? `rgba(${40 + Math.random() * 30}, ${brightness + 30}, ${20 + Math.random() * 15}, ${0.15 + Math.random() * 0.2})`
          : `rgba(${brightness}, ${brightness + 10}, ${15 + Math.random() * 10}, ${0.1 + Math.random() * 0.15})`,
      }
    })

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

      /* ── Fire glow — pulsing ── */
      const glowPulse = 0.07 + Math.sin(t * 0.0018) * 0.025 + Math.sin(t * 0.004) * 0.015
      const glowGrad = ctx!.createRadialGradient(fireX(), fireY(), 0, fireX(), fireY(), w * 0.22)
      glowGrad.addColorStop(0, `rgba(255, 140, 40, ${glowPulse})`)
      glowGrad.addColorStop(0.35, `rgba(255, 90, 15, ${glowPulse * 0.35})`)
      glowGrad.addColorStop(1, 'rgba(255, 60, 0, 0)')
      ctx!.fillStyle = glowGrad
      ctx!.fillRect(0, 0, w, h)

      /* ── Fog ── */
      for (const fog of fogLayers) {
        fog.x += fog.speed
        if (fog.x > w + fog.width * 0.5) fog.x = -fog.width
        const fogGrad = ctx!.createRadialGradient(
          fog.x + fog.width / 2, fog.y, 0,
          fog.x + fog.width / 2, fog.y, fog.width / 2,
        )
        fogGrad.addColorStop(0, `rgba(160, 140, 100, ${fog.opacity})`)
        fogGrad.addColorStop(1, 'rgba(160, 140, 100, 0)')
        ctx!.fillStyle = fogGrad
        ctx!.fillRect(fog.x, fog.y - fog.height, fog.width, fog.height * 2)
      }

      /* ── Grass blades — sway in wind ── */
      const windCycle = Math.sin(t * 0.0008) * 0.6 + Math.sin(t * 0.0013) * 0.4
      for (const blade of grassBlades) {
        const sway = Math.sin(t * 0.0015 + blade.phase) * blade.swayAmount * windCycle
        ctx!.beginPath()
        ctx!.moveTo(blade.x, blade.baseY)
        // Quadratic curve — base stays fixed, tip sways
        ctx!.quadraticCurveTo(
          blade.x + sway * 0.5, blade.baseY - blade.height * 0.6,
          blade.x + sway, blade.baseY - blade.height,
        )
        ctx!.strokeStyle = blade.color
        ctx!.lineWidth = blade.width
        ctx!.lineCap = 'round'
        ctx!.stroke()
      }

      /* ── Embers ── */
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i]
        if (!e) continue
        e.life++
        e.y -= e.speed
        e.x += e.drift + Math.sin(t * 0.0012 + e.phase) * 0.35

        const lifeFrac = e.life / e.maxLife
        const fadeIn = Math.min(lifeFrac * 6, 1)
        const fadeOut = lifeFrac > 0.65 ? 1 - (lifeFrac - 0.65) / 0.35 : 1
        const alpha = e.opacity * fadeIn * fadeOut

        if (e.life > e.maxLife) { embers[i] = spawnEmber(); continue }

        const glowR = e.r * 3.5
        const emberGlow = ctx!.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR)
        emberGlow.addColorStop(0, `rgba(${e.color[0]!}, ${e.color[1]!}, ${e.color[2]!}, ${alpha * 0.35})`)
        emberGlow.addColorStop(1, `rgba(${e.color[0]!}, ${e.color[1]!}, ${e.color[2]!}, 0)`)
        ctx!.fillStyle = emberGlow
        ctx!.fillRect(e.x - glowR, e.y - glowR, glowR * 2, glowR * 2)

        ctx!.beginPath()
        ctx!.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${e.color[0]!}, ${e.color[1]!}, ${e.color[2]!}, ${alpha})`
        ctx!.fill()
      }

      /* ── Fireflies ── */
      for (const f of fireflies) {
        const pulse = (Math.sin(t * 0.001 * f.speed + f.phase) + 1) / 2
        const alpha = f.brightness * pulse
        f.x = f.baseX + Math.sin(t * 0.0004 + f.phase) * 18
        f.y = f.baseY + Math.cos(t * 0.0006 + f.phase * 1.3) * 10

        const gR = f.r * 5
        const ffGlow = ctx!.createRadialGradient(f.x, f.y, 0, f.x, f.y, gR)
        ffGlow.addColorStop(0, `rgba(190, 240, 90, ${alpha * 0.25})`)
        ffGlow.addColorStop(1, 'rgba(190, 240, 90, 0)')
        ctx!.fillStyle = ffGlow
        ctx!.fillRect(f.x - gR, f.y - gR, gR * 2, gR * 2)

        ctx!.beginPath()
        ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(210, 250, 130, ${alpha})`
        ctx!.fill()
      }

      /* ── Floating ash ── */
      for (const a of ashes) {
        a.y -= a.speed
        a.x += Math.sin(t * 0.0007 + a.phase) * 0.25 + windCycle * 0.15
        a.rotation += a.rotSpeed
        if (a.y < -20) { a.y = h + 20; a.x = Math.random() * w }

        ctx!.save()
        ctx!.translate(a.x, a.y)
        ctx!.rotate(a.rotation)
        ctx!.beginPath()
        ctx!.ellipse(0, 0, a.r, a.r * 0.35, 0, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(160, 140, 110, ${a.opacity})`
        ctx!.fill()
        ctx!.restore()
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

/** Katana icon for Sensei role */
function KatanaIcon({ glow }: { glow?: boolean }) {
  return (
    <svg viewBox="0 0 64 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 48, height: 90 }}>
      <defs>
        <linearGradient id="katana-blade" x1="32" y1="8" x2="32" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={glow ? 'rgba(240,230,200,0.9)' : 'rgba(200,195,180,0.5)'} />
          <stop offset="100%" stopColor={glow ? 'rgba(180,170,140,0.7)' : 'rgba(140,135,120,0.3)'} />
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
        stroke={glow ? 'rgba(232,168,72,0.3)' : 'rgba(180,170,150,0.15)'}
        strokeWidth="0.5"
        filter={glow ? 'url(#katana-glow)' : undefined}
      />
      {/* Tsuba */}
      <ellipse cx="32" cy="78" rx="10" ry="3" fill={glow ? 'rgba(180,150,80,0.6)' : 'rgba(120,100,60,0.35)'} />
      {/* Handle */}
      <rect x="29" y="81" width="6" height="28" rx="1.5" fill={glow ? 'rgba(60,45,25,0.8)' : 'rgba(50,40,25,0.5)'} />
      {[0, 6, 12, 18, 24].map((y) => (
        <line key={y} x1="29" y1={83 + y} x2="35" y2={86 + y} stroke={glow ? 'rgba(160,130,70,0.35)' : 'rgba(120,100,60,0.15)'} strokeWidth="0.6" />
      ))}
      {/* Pommel */}
      <ellipse cx="32" cy="111" rx="4.5" ry="2" fill={glow ? 'rgba(160,130,70,0.5)' : 'rgba(100,80,50,0.3)'} />
    </svg>
  )
}

/** Shield / fist icon for Student role */
function StudentIcon({ glow }: { glow?: boolean }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 56, height: 56 }}>
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
          fill={glow ? 'rgba(232,168,72,0.6)' : 'rgba(180,160,120,0.3)'}
        />
        {/* Secondary beam */}
        <rect x="18" y="26" width="44" height="3" rx="1" fill={glow ? 'rgba(200,160,80,0.45)' : 'rgba(150,130,90,0.2)'} />
        {/* Left pillar */}
        <rect x="22" y="26" width="4" height="42" fill={glow ? 'rgba(200,160,80,0.45)' : 'rgba(150,130,90,0.2)'} />
        {/* Right pillar */}
        <rect x="54" y="26" width="4" height="42" fill={glow ? 'rgba(200,160,80,0.45)' : 'rgba(150,130,90,0.2)'} />
        {/* Base left */}
        <rect x="18" y="66" width="12" height="3" rx="1" fill={glow ? 'rgba(200,160,80,0.35)' : 'rgba(150,130,90,0.15)'} />
        {/* Base right */}
        <rect x="50" y="66" width="12" height="3" rx="1" fill={glow ? 'rgba(200,160,80,0.35)' : 'rgba(150,130,90,0.15)'} />
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

function RoleSelect({ onSelect }: { onSelect: (role: LoginRole) => void }) {
  const [hovered, setHovered] = useState<LoginRole | null>(null)

  const cardStyle = (r: LoginRole): React.CSSProperties => ({
    background: hovered === r ? 'rgba(8,8,10,0.75)' : 'rgba(8,8,10,0.65)',
    backdropFilter: 'blur(24px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
    border: `1px solid ${hovered === r ? 'rgba(232,168,72,0.4)' : 'rgba(200,170,100,0.15)'}`,
    borderRadius: 16,
    padding: '32px 28px 24px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    transition: 'all 0.35s ease',
    transform: hovered === r ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
    boxShadow: hovered === r
      ? '0 0 40px rgba(232,168,72,0.12), 0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
      : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
    width: 'clamp(140px, 18vw, 180px)',
  })

  return (
    <div
      className="relative z-10"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 36,
        animation: 'gameMenuAppear 0.8s ease-out both',
        animationDelay: '0.3s',
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(24px, 3.5vw, 36px)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: 'rgba(240,237,232,0.95)',
            margin: 0,
            textShadow: '0 2px 16px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.3)',
          }}
        >
          Choose Your Path
        </h1>
        <div
          aria-hidden
          style={{
            height: 1,
            width: 140,
            margin: '16px auto 0',
            background: 'linear-gradient(90deg, transparent, rgba(232,168,72,0.35), transparent)',
          }}
        />
      </div>

      {/* Two role cards */}
      <div style={{ display: 'flex', gap: 'clamp(20px, 4vw, 48px)', alignItems: 'center' }}>
        {/* Sensei card */}
        <button
          type="button"
          onClick={() => onSelect('coach')}
          onMouseEnter={() => setHovered('coach')}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle('coach')}
          aria-label="Sign in as Sensei (Coach)"
        >
          <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KatanaIcon glow={hovered === 'coach'} />
          </div>
          <div
            aria-hidden
            style={{ width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${hovered === 'coach' ? 'rgba(232,168,72,0.3)' : 'rgba(200,170,100,0.12)'}, transparent)` }}
          />
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: '0.1em',
                color: hovered === 'coach' ? '#f0cc6a' : 'rgba(230,225,215,0.9)',
                transition: 'color 0.3s, text-shadow 0.3s',
                textShadow: hovered === 'coach' ? '0 0 16px rgba(232,168,72,0.4)' : '0 1px 6px rgba(0,0,0,0.5)',
                display: 'block',
              }}
            >
              SENSEI
            </span>
            <span
              style={{
                fontSize: 11,
                color: hovered === 'coach' ? 'rgba(210,200,180,0.7)' : 'rgba(200,190,170,0.5)',
                transition: 'color 0.3s',
                letterSpacing: '0.04em',
                marginTop: 6,
                display: 'block',
              }}
            >
              Coach workspace
            </span>
          </div>
        </button>

        {/* Decorative divider */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 1, height: 50, background: 'linear-gradient(180deg, transparent, rgba(200,170,100,0.2), transparent)' }} />
          <span style={{ fontSize: 10, color: 'rgba(200,190,170,0.25)', letterSpacing: '0.12em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>OR</span>
          <div style={{ width: 1, height: 50, background: 'linear-gradient(180deg, transparent, rgba(200,170,100,0.2), transparent)' }} />
        </div>

        {/* Student card */}
        <button
          type="button"
          onClick={() => onSelect('student')}
          onMouseEnter={() => setHovered('student')}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle('student')}
          aria-label="Sign in as Student (Client)"
        >
          <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StudentIcon glow={hovered === 'student'} />
          </div>
          <div
            aria-hidden
            style={{ width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${hovered === 'student' ? 'rgba(232,168,72,0.3)' : 'rgba(200,170,100,0.12)'}, transparent)` }}
          />
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: '0.1em',
                color: hovered === 'student' ? '#f0cc6a' : 'rgba(230,225,215,0.9)',
                transition: 'color 0.3s, text-shadow 0.3s',
                textShadow: hovered === 'student' ? '0 0 16px rgba(232,168,72,0.4)' : '0 1px 6px rgba(0,0,0,0.5)',
                display: 'block',
              }}
            >
              STUDENT
            </span>
            <span
              style={{
                fontSize: 11,
                color: hovered === 'student' ? 'rgba(210,200,180,0.7)' : 'rgba(200,190,170,0.5)',
                transition: 'color 0.3s',
                letterSpacing: '0.04em',
                marginTop: 6,
                display: 'block',
              }}
            >
              Client portal
            </span>
          </div>
        </button>
      </div>

      {/* Signup link */}
      <p style={{ fontSize: 13, color: 'rgba(200,190,170,0.5)', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
        New here?{' '}
        <Link
          href="/signup"
          style={{ fontWeight: 500, color: '#e8a948', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f0c060' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#e8a948' }}
        >
          Begin your journey
        </Link>
      </p>

      {/* Bottom tagline */}
      <p
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'rgba(200,190,170,0.4)',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          margin: 0,
        }}
      >
        Discipline is the path.
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
        onMouseEnter={(e) => { e.currentTarget.style.color = '#e8a948' }}
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
            {isSensei ? 'Welcome back, Sensei' : 'Enter the Dojo'}
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

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              style={{
                width: '100%', height: 44, borderRadius: 10,
                border: emailInvalid ? '1px solid rgba(220,60,60,0.5)' : '1px solid rgba(200,170,100,0.08)',
                background: 'rgba(255,255,255,0.035)', padding: '0 14px', fontSize: 14,
                color: 'rgba(240,237,232,0.9)', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' as const,
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(200,150,60,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,150,60,0.08)' }}
              onBlurCapture={(e) => { e.target.style.borderColor = emailInvalid ? 'rgba(220,60,60,0.5)' : 'rgba(200,170,100,0.08)'; e.target.style.boxShadow = 'none' }}
            />
            {emailInvalid && <p style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>Enter a valid email address.</p>}
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label htmlFor="login-password" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(200,190,170,0.55)' }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                style={{ fontSize: 11, color: 'rgba(200,190,170,0.5)', textDecoration: 'none', transition: 'color 0.15s' }}
                tabIndex={-1}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e8a948' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(200,190,170,0.5)' }}
              >
                Forgot?
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
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  border: '1px solid rgba(200,170,100,0.08)',
                  background: 'rgba(255,255,255,0.035)', padding: '0 42px 0 14px', fontSize: 14,
                  color: 'rgba(240,237,232,0.9)', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' as const,
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(200,150,60,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,150,60,0.08)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(200,170,100,0.08)'; e.target.style.boxShadow = 'none' }}
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
              marginTop: 4, height: 46, width: '100%', borderRadius: 10,
              border: '1px solid rgba(200,150,60,0.25)',
              background: 'linear-gradient(135deg, rgba(200,140,40,0.2) 0%, rgba(180,100,20,0.12) 100%)',
              color: '#e8c873', fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
            }}
          >
            {loading ? (
              <div style={{ width: 18, height: 18, border: '2px solid rgba(232,200,115,0.3)', borderTopColor: '#e8c873', borderRadius: '50%', animation: 'gameMenuSpin 0.7s linear infinite', margin: '0 auto' }} />
            ) : (
              'Enter'
            )}
          </button>
        </form>

        {/* Divider */}
        <div aria-hidden style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(200,170,100,0.12), transparent)', margin: '20px 0 16px' }} />

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'rgba(200,190,170,0.5)', margin: 0 }}>
            New here?{' '}
            <Link
              href="/signup"
              style={{ fontWeight: 500, color: '#e8a948', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f0c060' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#e8a948' }}
            >
              Begin your journey
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

/* ───────────────── Main component ───────────────── */

export function DualRoleLoginPage() {
  const [view, setView] = useState<ViewState>('select')
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
          backgroundImage: 'url(/images/login-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Dark overlay */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(5,5,5,0.45) 0%, rgba(5,5,5,0.3) 30%, rgba(5,5,5,0.35) 55%, rgba(5,5,5,0.7) 100%)' }} />

      {/* Vignette */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.55) 100%)' }} />

      {/* ═══ CINEMATIC CANVAS ═══ */}
      <CinematicCanvas />

      {/* ═══ TOP BAR ═══ */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '0.06em', color: 'rgba(240,237,232,0.92)', lineHeight: 1, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
          SENSEI<span style={{ color: '#e8943a' }}> APP</span>
        </div>
        <p style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(200,190,170,0.5)', textShadow: '0 1px 6px rgba(0,0,0,0.6)', margin: 0 }}>
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
          background: linear-gradient(135deg, rgba(200,140,40,0.3) 0%, rgba(180,100,20,0.2) 100%) !important;
          border-color: rgba(200,150,60,0.4) !important;
          box-shadow: 0 0 24px rgba(200,140,40,0.12);
        }
      `}</style>
    </div>
  )
}
