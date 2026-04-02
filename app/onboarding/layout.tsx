import Link from 'next/link'
import { type ReactNode } from 'react'
import { ClearPathLogo } from '@/components/layout/ClearPathLogo'
import { OnboardingHeaderActions } from '@/components/layout/OnboardingHeaderActions'
import { OnboardingProgress } from './OnboardingProgress'

/**
 * Onboarding layout: centered flow with sky-tinted backdrop (aligned with login mood).
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F9FC]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(165deg,#E3EEF8_0%,#F0F6FC_18%,#F8FAFC_42%,#ffffff_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 120% 80% at 0% -20%, rgba(26, 123, 212, 0.14), transparent 50%),
            radial-gradient(ellipse 90% 60% at 100% 10%, rgba(16, 86, 160, 0.1), transparent 45%),
            radial-gradient(circle at 50% 100%, rgba(59, 158, 232, 0.06), transparent 55%)
          `,
        }}
        aria-hidden
      />

      <header className="relative border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-4 py-4 md:px-6">
          <Link
            href="/onboarding"
            className="flex items-center gap-2.5 text-[var(--text-primary)] transition-opacity hover:opacity-80"
          >
            <ClearPathLogo size={28} />
            <span className="text-[17px] font-medium tracking-[-0.02em]" style={{ fontFamily: 'var(--font-sora)' }}>
              Clear<span className="text-[var(--accent)]">Path</span>
            </span>
          </Link>
          <OnboardingHeaderActions />
        </div>
      </header>
      <main className="relative mx-auto max-w-[760px] px-4 pb-24 pt-8 md:px-8 md:pt-10">
        <OnboardingProgress />
        <div className="mt-6 md:mt-8">{children}</div>
      </main>
    </div>
  )
}
