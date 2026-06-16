'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * First-login welcome panel for a brand-new coach. Shows once per browser
 * (localStorage-gated — no schema change), greets the coach by name, and points
 * to the first moves that matter. Video is framed as "coming this week" while
 * Bunny is being reconnected, so nothing reads as broken. Fully reversible:
 * delete this component + its mount in CoachDashboardHome to remove.
 */

const SEEN_KEY = 'korva_welcome_seen_v1'

type Step = {
  medal: string
  tile: string
  title: string
  desc: string
  href?: string
  cta?: string
  soon?: boolean
}

const STEPS: Step[] = [
  {
    medal: '👥',
    tile: 'var(--belt-yellow)',
    title: 'Add your students',
    desc: 'Bring your athletes in and send them their portal invite.',
    href: '/coach/clients',
    cta: 'Add students',
  },
  {
    medal: '🗓️',
    tile: 'var(--belt-blue)',
    title: 'Set up classes & programs',
    desc: 'Build your weekly schedule and your signature programs.',
    href: '/coach/classes',
    cta: 'Set up',
  },
  {
    medal: '💳',
    tile: 'var(--belt-green)',
    title: 'Turn on payments',
    desc: 'Connect Stripe so payments from clients land straight in your account.',
    href: '/coach/settings',
    cta: 'Connect',
  },
  {
    medal: '🎬',
    tile: 'var(--belt-coral)',
    title: 'Session videos',
    desc: 'Upload clips your students can rewatch — switching on this week.',
    soon: true,
  },
]

export function WelcomeGuide({ coachFirst }: { coachFirst: string }) {
  const [open, setOpen] = useState(false)

  // Client-only: decide whether to open after mount to avoid a hydration mismatch.
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true)
    } catch {
      /* localStorage blocked — just don't auto-open */
    }
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-guide-title"
      onClick={dismiss}
    >
      <div
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[18px] border-[3px] border-[var(--border-default)] bg-[var(--bg-app)] shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b-[3px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-5">
          <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Welcome to Korva
          </div>
          <h2
            id="welcome-guide-title"
            className="mt-1 font-[family-name:var(--font-display)] text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--text-primary)]"
          >
            Your dojo’s ready, {coachFirst} 🥋
          </h2>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[13px] font-medium text-[var(--text-secondary)]">
            Four quick moves to get rolling — do them in any order.
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2.5 px-6 py-5">
          {STEPS.map((step) => {
            const inner = (
              <>
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--border-default)] text-[19px]"
                  style={{ background: step.tile, boxShadow: '3px 3px 0 var(--border-default)' }}
                >
                  {step.medal}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-display)] text-[14px] font-extrabold text-[var(--text-primary)]">
                      {step.title}
                    </span>
                    {step.soon ? (
                      <span className="rounded-full border-2 border-[var(--border-default)] bg-[var(--bg-muted)] px-2 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-extrabold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                        Soon
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-tertiary)]">
                    {step.desc}
                  </p>
                </div>
                {step.href ? (
                  <span className="shrink-0 self-center font-[family-name:var(--font-display)] text-[12px] font-extrabold text-[var(--accent)]">
                    {step.cta} →
                  </span>
                ) : null}
              </>
            )
            const rowClass =
              'flex items-start gap-3 rounded-[12px] border-[3px] border-[var(--border-default)] px-3.5 py-3'
            if (step.href) {
              return (
                <Link
                  key={step.title}
                  href={step.href}
                  onClick={dismiss}
                  className={`${rowClass} bg-[var(--bg-subtle)] shadow-[var(--shadow-sm)] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-md)]`}
                >
                  {inner}
                </Link>
              )
            }
            return (
              <div key={step.title} className={`${rowClass} bg-[var(--bg-muted)]`}>
                {inner}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t-[3px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-[family-name:var(--font-display)] text-[12px] font-semibold text-[var(--text-tertiary)]">
            More on the way: content &amp; promo tools to grow your dojo.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="btn-primary-gloss inline-flex shrink-0 items-center justify-center rounded-[10px] border-[3px] border-[var(--border-default)] px-5 py-2 font-[family-name:var(--font-display)] text-[13px] font-extrabold text-[var(--text-on-accent)]"
          >
            Let’s go
          </button>
        </div>
      </div>
    </div>
  )
}
