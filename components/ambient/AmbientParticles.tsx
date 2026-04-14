'use client'

import { useEffect, useRef } from 'react'
import type { StanceId } from '@/lib/stances'

interface ParticleConfig {
  color: string
  count: number
  sizeMin: number
  sizeMax: number
  speedMin: number
  speedMax: number
  opacityMin: number
  opacityMax: number
}

const STANCE_PARTICLES: Record<string, ParticleConfig> = {
  izuhara: {
    color: '196, 164, 74',
    count: 18,
    sizeMin: 1,
    sizeMax: 2.5,
    speedMin: 0.08,
    speedMax: 0.25,
    opacityMin: 0.08,
    opacityMax: 0.25,
  },
  toyotama: {
    color: '90, 138, 74',
    count: 14,
    sizeMin: 1.5,
    sizeMax: 3,
    speedMin: 0.1,
    speedMax: 0.3,
    opacityMin: 0.06,
    opacityMax: 0.2,
  },
  kamiagata: {
    color: '180, 200, 220',
    count: 20,
    sizeMin: 0.8,
    sizeMax: 2,
    speedMin: 0.05,
    speedMax: 0.2,
    opacityMin: 0.05,
    opacityMax: 0.18,
  },
  crimson: {
    color: '200, 100, 60',
    count: 12,
    sizeMin: 1,
    sizeMax: 2,
    speedMin: 0.15,
    speedMax: 0.4,
    opacityMin: 0.06,
    opacityMax: 0.2,
  },
  ronin: {
    color: '180, 160, 130',
    count: 15,
    sizeMin: 0.8,
    sizeMax: 2,
    speedMin: 0.06,
    speedMax: 0.2,
    opacityMin: 0.05,
    opacityMax: 0.15,
  },
}

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  drift: number
  phase: number
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function AmbientParticles({ stanceId }: { stanceId: StanceId | string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Skip on mobile
    if (window.matchMedia('(max-width: 768px)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const config = STANCE_PARTICLES[stanceId ?? 'izuhara'] ?? STANCE_PARTICLES.izuhara!

    let w = window.innerWidth
    let h = window.innerHeight
    canvas.width = w
    canvas.height = h

    const handleResize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    window.addEventListener('resize', handleResize, { passive: true })

    // Create particles
    const particles: Particle[] = Array.from({ length: config.count }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      size: rand(config.sizeMin, config.sizeMax),
      speedX: rand(-config.speedMax, config.speedMax) * 0.3,
      speedY: -rand(config.speedMin, config.speedMax),
      opacity: rand(config.opacityMin, config.opacityMax),
      drift: rand(0.2, 0.8),
      phase: rand(0, Math.PI * 2),
    }))

    let animId: number
    let lastFrame = 0
    const frameInterval = 1000 / 30 // cap at 30fps
    let hidden = false

    const onVisibility = () => {
      hidden = document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)

    function draw(time: number) {
      animId = requestAnimationFrame(draw)
      if (hidden) return

      const delta = time - lastFrame
      if (delta < frameInterval) return
      lastFrame = time - (delta % frameInterval)

      ctx!.clearRect(0, 0, w, h)

      for (const p of particles) {
        // Drift motion
        p.x += p.speedX + Math.sin(time * 0.0005 + p.phase) * p.drift * 0.15
        p.y += p.speedY

        // Wrap around edges
        if (p.y < -10) {
          p.y = h + 10
          p.x = rand(0, w)
        }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10

        // Pulse opacity slightly
        const opacityPulse = p.opacity + Math.sin(time * 0.001 + p.phase) * 0.03

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${config.color}, ${Math.max(0, opacityPulse)})`
        ctx!.fill()
      }
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [stanceId])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}
