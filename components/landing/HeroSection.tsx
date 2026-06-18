'use client'

import Link from 'next/link'
import { Rocket, MapPin, ArrowRight } from 'lucide-react'

/**
 * Above-the-fold content must be visible on FIRST PAINT (no JS / pre-hydration).
 * We deliberately do NOT use framer-motion `initial="hidden"` here, because that
 * renders the SSR HTML at opacity:0 and the hero stays blank until JS hydrates.
 *
 * Instead the markup is fully visible by default, and a tasteful entrance is layered
 * on as a pure-CSS enhancement (see the <style> block below). The keyframes only run
 * under `prefers-reduced-motion: no-preference`; the default/reduced-motion/no-JS
 * state is opacity:1 with no transform, so the content is always readable.
 */
export function HeroSection() {
  return (
    <section className="relative bg-[var(--bg-app)] pt-16">
      <style>{heroRevealCss}</style>

      {/* Founding banner */}
      <div className="border-b-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] text-center px-4 py-2.5 font-[family-name:var(--font-display)] text-[13px] sm:text-sm font-bold tracking-[-0.01em] text-[var(--ink)]">
        🥋 10 founding spots · $99/mo — locked for the first 10 coaches while subscribed
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* LEFT: copy */}
          <div>
            <div className="hero-reveal flex flex-wrap items-center gap-2.5 mb-6" style={{ '--hero-i': 0 } as React.CSSProperties}>
              <span className="arcade-badge arcade-badge-teal">🏋️ Solo coach tool</span>
              <span className="arcade-badge arcade-badge-yellow">⚡ Setup in an afternoon</span>
            </div>

            <h1
              className="hero-reveal font-[family-name:var(--font-display)] text-[2.6rem] sm:text-5xl md:text-6xl font-extrabold leading-[1.03] tracking-[-0.04em] text-[var(--ink)]"
              style={{ '--hero-i': 1 } as React.CSSProperties}
            >
              Run your whole
              <br />
              coaching practice
              <br />
              <span style={{ color: 'var(--belt-teal)' }}>from one place.</span>
            </h1>

            <p
              className="hero-reveal mt-5 text-lg font-medium text-[var(--text-secondary)] max-w-[440px]"
              style={{ '--hero-i': 2 } as React.CSSProperties}
            >
              Scheduling, classes, payments, belts, and messaging — the all-in-one OS built for solo
              martial-arts and fitness coaches.
            </p>

            <div
              className="hero-reveal mt-7 flex flex-wrap items-center gap-3"
              style={{ '--hero-i': 3 } as React.CSSProperties}
            >
              <Link
                href="/signup?role=coach"
                className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-base text-[var(--ink)] bg-[var(--belt-yellow)] border-[3px] border-[var(--ink)] rounded-[14px] px-6 py-3.5 shadow-[5px_5px_0_#b8910f] hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_#b8910f] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
              >
                <Rocket size={18} /> Start your free 14-day trial <ArrowRight size={16} />
              </Link>
              <Link
                href="/signup?role=student"
                className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-base text-[var(--ink)] bg-transparent border-[3px] border-[var(--ink)] rounded-[14px] px-5 py-3.5 hover:bg-white transition-colors"
              >
                <MapPin size={17} /> Find a coach
              </Link>
            </div>

            <p
              className="hero-reveal mt-4 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)]"
              style={{ '--hero-i': 4 } as React.CSSProperties}
            >
              14 days free · $0 due today · then $99/mo · cancel anytime
            </p>

            <div
              className="hero-reveal mt-4 flex flex-wrap gap-x-5 gap-y-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)]"
              style={{ '--hero-i': 5 } as React.CSSProperties}
            >
              <span>✓ 14 days free</span>
              <span>✓ $0 due today</span>
              <span>✓ Cancel anytime</span>
            </div>

            <div className="hero-reveal mt-7" style={{ '--hero-i': 6 } as React.CSSProperties}>
              <Link
                href="/login"
                className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)] hover:text-[var(--ink)] inline-flex items-center gap-1.5"
              >
                Already a member?{' '}
                <span className="text-[var(--ink)] underline decoration-[var(--belt-yellow)] decoration-2 underline-offset-2">
                  Log in
                </span>
              </Link>
            </div>
          </div>

          {/* RIGHT: app preview */}
          <div className="hero-reveal lg:pl-4" style={{ '--hero-i': 2 } as React.CSSProperties}>
            <HeroAppPreview />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Pure-CSS entrance. The base state is fully visible (opacity:1, no transform), so
 * server-rendered HTML and reduced-motion users see the finished hero immediately.
 * Only when motion is allowed do we start slightly down + faded and animate up.
 */
const heroRevealCss = `
@media (prefers-reduced-motion: no-preference) {
  .hero-reveal {
    opacity: 0;
    transform: translateY(24px);
    animation: heroReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--hero-i, 0) * 0.1s);
  }
}
@keyframes heroReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`

function HeroAppPreview() {
  const nav: [string, string, boolean][] = [
    ['⬛', 'Dashboard', true],
    ['📅', 'Schedule', false],
    ['👥', 'Clients', false],
    ['🥊', 'Classes', false],
    ['💬', 'Messages', false],
    ['💳', 'Payments', false],
  ]
  return (
    <div className="mx-auto max-w-[520px] overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-white shadow-[7px_7px_0_var(--ink)]">
      {/* top bar */}
      <div className="flex items-center justify-between border-b-[3px] border-[var(--ink)] bg-[var(--ink)] px-4 py-3">
        <div className="font-[family-name:var(--font-display)] text-base font-extrabold text-[#faf7f0]">
          Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="arcade-badge arcade-badge-yellow !text-[11px] !py-1">🔥 12-day streak</span>
          <span className="grid h-8 w-8 place-content-center rounded-[9px] border-2 border-[var(--ink)] bg-[var(--belt-teal)] font-[family-name:var(--font-display)] text-[11px] font-extrabold text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
            MV
          </span>
        </div>
      </div>
      <div className="flex min-h-[320px]">
        {/* mini sidebar */}
        <div className="flex w-[120px] flex-col gap-1 border-r-[3px] border-[var(--ink)] bg-[var(--ink)] p-3">
          {nav.map(([ic, lbl, active]) => (
            <div
              key={lbl}
              className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold ${
                active ? 'bg-[var(--belt-yellow)] text-[var(--ink)]' : 'text-[#faf7f0]/55'
              }`}
            >
              <span>{ic}</span>
              {lbl}
            </div>
          ))}
        </div>
        {/* main */}
        <div className="flex-1 bg-[var(--bg-app)] p-4">
          <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Tuesday · Vale Method
          </div>
          <div className="mt-0.5 mb-3 font-[family-name:var(--font-display)] text-lg font-extrabold tracking-[-0.02em]">
            Good morning, Marcus 👊
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="tile-yellow !shadow-[3px_3px_0_#b8910f] !rounded-[10px] p-3 text-center">
              <div className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.03em]">24</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] font-[family-name:var(--font-display)]">Students</div>
            </div>
            <div className="tile-teal !shadow-[3px_3px_0_#1a8a80] !rounded-[10px] p-3 text-center">
              <div className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.03em] text-[var(--ink)]">$1,840</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]/70 font-[family-name:var(--font-display)]">This week</div>
            </div>
            <div className="tile-coral !shadow-[3px_3px_0_#cc2929] !rounded-[10px] p-3 text-center">
              <div className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.03em] text-[var(--ink)]">3</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]/70 font-[family-name:var(--font-display)]">Unread</div>
            </div>
          </div>
          <div className="rounded-[12px] border-[3px] border-[var(--ink)] bg-white p-3 shadow-[3px_3px_0_var(--ink)]">
            <div className="mb-2 font-[family-name:var(--font-display)] text-xs font-bold">📅 Today&apos;s sessions</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-display)] font-bold min-w-[36px]">9:00a</span>
                <span className="flex-1">Diego Santos · Private</span>
                <span className="arcade-badge arcade-badge-teal !text-[9px] !px-1.5 !py-0.5">✓</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-display)] font-bold min-w-[36px]">11:00a</span>
                <span className="flex-1">Sarah Chen · Private</span>
                <span className="arcade-badge !text-[9px] !px-1.5 !py-0.5">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-display)] font-bold min-w-[36px]">6:00p</span>
                <span className="flex-1">Fundamentals · Group</span>
                <span className="arcade-badge arcade-badge-yellow !text-[9px] !px-1.5 !py-0.5">8/12</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
