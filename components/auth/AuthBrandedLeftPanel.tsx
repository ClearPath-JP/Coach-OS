import type { ReactNode } from 'react'
import { AuthWordmark } from '@/components/auth/AuthWordmark'

const DEFAULT_HEADLINE = (
  <>
    Run your coaching
    <br />
    business better.
  </>
)

const DEFAULT_SUBTEXT = (
  <>
    Client management, scheduling, programs, and payments.
    <br />
    Everything in one place.
  </>
)

const COACH_LOGIN_HEADLINE = (
  <>
    Run your coaching business
    <br />
    like a pro.
  </>
)

const COACH_LOGIN_SUBTEXT = (
  <>
    Your clients. Your sessions. Your revenue. All in one place — so you can focus on what you do best.
  </>
)

const COACH_LOGIN_FEATURES = [
  'Know which clients need attention today',
  'Get paid faster with smart invoicing',
  'Keep clients engaged between sessions',
]

/** Deeper blue than signup — coach login left column + mobile bar (brand tokens + fallbacks). */
const COACH_LOGIN_BLUE_BG =
  'linear-gradient(155deg, color-mix(in srgb, var(--brand-primary, #1565C0) 18%, #000) 0%, color-mix(in srgb, var(--brand-primary, #1565C0) 35%, #000) 45%, color-mix(in srgb, var(--accent, #3B9EE8) 25%, #000) 100%)'

/**
 * Marketing column for auth. `marketing-blue` (default): brighter gradient (signup). `coach-login-light`: darker blue
 * column + light text — coach login only.
 */
export function AuthBrandedLeftPanel({
  headline,
  subtext,
  variant = 'marketing-blue',
  featureList,
}: {
  headline?: ReactNode
  subtext?: ReactNode
  variant?: 'marketing-blue' | 'coach-login-light'
  /** When set, replaces the default bullet list for this variant. */
  featureList?: string[]
}) {
  const isLight = variant === 'coach-login-light'
  const h = headline ?? (isLight ? COACH_LOGIN_HEADLINE : DEFAULT_HEADLINE)
  const s = subtext ?? (isLight ? COACH_LOGIN_SUBTEXT : DEFAULT_SUBTEXT)

  const defaultFeatures = [
    'Manage all your clients in one place',
    'Schedule sessions with drag & drop',
    'Track payments and revenue',
    'Build and assign coaching programs',
  ]
  const features = featureList ?? (isLight ? COACH_LOGIN_FEATURES : defaultFeatures)

  if (isLight) {
    return (
      <div
        className="relative hidden min-h-screen w-full flex-col justify-between border-r border-white/10 p-10 text-white lg:flex lg:py-14 lg:pl-12 lg:pr-10 xl:pl-14 xl:pr-12"
        style={{ background: COACH_LOGIN_BLUE_BG }}
      >
        <div className="flex items-center pt-1">
          <AuthWordmark
            variant="panel"
            tone="onDark"
            className="!text-[1.65rem] sm:!text-[1.85rem] lg:!text-[2rem]"
          />
        </div>

        <div className="flex max-w-xl flex-1 flex-col justify-center py-10 lg:py-14">
          <h2 className="text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3.15rem] xl:text-[3.35rem]">
            {h}
          </h2>
          <p className="mt-5 text-[17px] font-normal leading-[1.65] text-white/85 sm:text-[18px]">{s}</p>

          <ul className="mt-10 flex flex-col gap-3.5">
            {features.map((line) => (
              <li
                key={line}
                className="flex items-start gap-3 text-[15px] font-normal leading-snug text-white/95 sm:text-[15.5px]"
              >
                <span
                  className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/10"
                  aria-hidden
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-2xl border border-white/20 p-5"
          style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <p className="text-[15px] italic leading-[1.65] text-white/90">
            &ldquo;Kindo changed how I run my business. My clients feel more supported than ever.&rdquo;
          </p>
          <p className="mt-3 text-[13px] font-medium text-white/70">— Sarah M., Performance Coach</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative hidden min-h-screen w-full flex-col justify-between p-14 text-white lg:flex"
      style={{
        padding: '64px 56px',
        background:
          'linear-gradient(145deg, var(--brand-primary, #1565C0) 0%, var(--accent, #3B9EE8) 50%, var(--accent-muted, #7EC8F0) 100%)',
      }}
    >
      <div className="flex items-center">
        <AuthWordmark variant="panel" tone="onDark" />
      </div>

      <div className="flex max-w-xl flex-1 flex-col justify-center py-12">
        <h2 className="text-[44px] font-bold leading-[1.1] tracking-[-0.03em] text-white">{h}</h2>
        <p className="mt-4 text-[16px] font-normal leading-[1.7] text-white/80">{s}</p>

        <ul className="mt-8 flex flex-col gap-3">
          {features.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[14px] font-normal leading-snug text-white">
              <span
                className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10"
                aria-hidden
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="rounded-[12px] border border-white/20 p-4"
        style={{
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <p className="text-[14px] italic leading-[1.6] text-white/90">
          &ldquo;Kindo changed how I run my business. My clients feel more supported than ever.&rdquo;
        </p>
        <p className="mt-2 text-[12px] text-white/70">— Sarah M., Performance Coach</p>
      </div>
    </div>
  )
}
