import type { ReactNode } from 'react'

/**
 * Marketing column for coach login / signup (desktop).
 */
export function AuthBrandedLeftPanel({
  headline = (
    <>
      Run your coaching
      <br />
      business better.
    </>
  ),
  subtext = (
    <>
      Client management, scheduling, programs, and payments.
      <br />
      Everything in one place.
    </>
  ),
}: {
  headline?: ReactNode
  subtext?: ReactNode
}) {
  const features = [
    'Manage all your clients in one place',
    'Schedule sessions with drag & drop',
    'Track payments and revenue',
    'Build and assign coaching programs',
  ]

  return (
    <div
      className="relative hidden min-h-screen w-full flex-col justify-between p-14 text-white lg:flex"
      style={{
        padding: '64px 56px',
        background: 'linear-gradient(145deg, #1565C0 0%, #2196F3 40%, #64B5F6 100%)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-7 shrink-0 rounded-[8px]"
          style={{ background: 'rgba(255,255,255,0.2)' }}
          aria-hidden
        />
        <span className="text-[20px] font-bold text-white">ClearPath</span>
      </div>

      <div className="flex max-w-xl flex-1 flex-col justify-center py-12">
        <h2 className="text-[44px] font-bold leading-[1.1] tracking-[-0.03em] text-white">{headline}</h2>
        <p className="mt-4 text-[16px] font-normal leading-[1.7] text-white/80">{subtext}</p>

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
          &ldquo;ClearPath changed how I run my business. My clients feel more supported than ever.&rdquo;
        </p>
        <p className="mt-2 text-[12px] text-white/70">— Sarah M., Performance Coach</p>
      </div>
    </div>
  )
}
