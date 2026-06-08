'use client'

import { Zap, LayoutDashboard, Sparkles, LineChart } from 'lucide-react'

const FEATURES = [
  { icon: Zap, text: 'Less admin. More coaching time.' },
  { icon: LayoutDashboard, text: 'Full visibility into client progress.' },
  { icon: Sparkles, text: 'Automated session notes & follow-ups.' },
  { icon: LineChart, text: 'Revenue tracking built for solo coaches.' },
] as const

const AVATAR_INITIALS = ['JM', 'SR', 'AL', 'KP', 'TN'] as const

/**
 * Left column (lg+): gradient value panel + social proof (coach login spec).
 */
export function AuthMarketingHeroPanel() {
  return (
    <div className="login-hero-root" aria-hidden>
      <div className="relative z-[1] flex h-full flex-col px-10 py-16 md:px-14 md:py-20">
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <p
            className="login-hero-fade-up mb-10 text-left text-[clamp(15px,1.2vw,18px)] tracking-[-0.02em]"
            style={{ animationDelay: '0.05s' }}
          >
            <span className="font-bold text-white">Korva</span>
          </p>

          <h2
            className="login-hero-fade-up max-w-[420px] font-extrabold leading-[1.15] tracking-[-0.03em] text-white"
            style={{
              animationDelay: '0.1s',
              fontSize: 'clamp(28px, 3vw, 42px)',
            }}
          >
            Run your business like a pro.
          </h2>

          <p
            className="login-hero-fade-up mt-5 max-w-[400px] text-base leading-[1.6] text-white/[0.65]"
            style={{ animationDelay: '0.18s' }}
          >
            Clients, sessions, programs, and revenue — one refined workspace built for coaches.
          </p>

          <ul className="mt-10 flex max-w-[400px] flex-col gap-4">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                className="login-hero-fade-up flex items-center gap-3 text-[14px] leading-snug text-white/80"
                style={{ animationDelay: `${0.22 + i * 0.1}s` }}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-cp-sky/30 bg-cp-sky/15 text-cp-sky"
                  aria-hidden
                >
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="login-hero-fade-up mt-10 text-[13px] text-white/60"
          style={{ animationDelay: '0.65s' }}
        >
          <span className="min-w-0">Built for coaches who train champions</span>
        </div>
      </div>
    </div>
  )
}
