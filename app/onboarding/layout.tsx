import { type ReactNode } from 'react'
import { AuthBrandedLeftPanel } from '@/components/auth/AuthBrandedLeftPanel'
import { AuthWordmark } from '@/components/auth/AuthWordmark'
import { OnboardingHeaderActions } from '@/components/layout/OnboardingHeaderActions'
import { OnboardingProgress } from './OnboardingProgress'

const ONBOARDING_HEADLINE = (
  <>
    You&apos;re minutes away from
    <br />a clearer practice.
  </>
)

const ONBOARDING_SUBTEXT = (
  <>
    We&apos;ll set up your workspace, your focus areas, and an optional first client — then you&apos;re in your dashboard.
  </>
)

const ONBOARDING_FEATURES = [
  'Workspace, brand, and clients in one calm flow',
  'Change anything later in Settings',
  'Most coaches finish in under five minutes',
]

const MOBILE_NAVY =
  'linear-gradient(155deg, #041a33 0%, #082952 28%, #0B2D5E 55%, #0d47a1 88%, #115293 100%)'

/**
 * Split layout aligned with coach login: navy brand column (lg+) + focused main column.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:min-h-0 lg:grid-cols-[52fr_48fr]">
      <aside className="hidden lg:contents" aria-label="Getting started with ClearPath">
        <AuthBrandedLeftPanel
          variant="coach-login-light"
          headline={ONBOARDING_HEADLINE}
          subtext={ONBOARDING_SUBTEXT}
          featureList={ONBOARDING_FEATURES}
        />
      </aside>

      <div className="relative flex min-h-screen flex-col bg-[var(--cp-offwhite)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[128px] border-b border-white/10 lg:hidden"
          style={{ background: MOBILE_NAVY }}
          aria-hidden
        />

        <div className="relative z-[1] flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-7 md:px-8 lg:hidden">
            <AuthWordmark variant="banner" tone="onDark" className="!text-[1.35rem] sm:!text-[1.5rem]" />
            <OnboardingHeaderActions className="text-white/90 hover:bg-white/10 hover:text-white" />
          </div>

          <header className="hidden border-b border-[var(--border-subtle)] bg-[var(--cp-offwhite)] lg:block">
            <div className="flex items-center justify-between gap-4 px-10 pb-4 pt-10">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
                  Getting started
                </p>
                <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Set up your coach workspace
                </p>
              </div>
              <OnboardingHeaderActions />
            </div>
          </header>

          <main className="flex-1 px-4 pb-16 pt-4 md:px-8 md:pt-6 lg:px-10 lg:pb-20 lg:pt-6">
            <div className="mx-auto w-full max-w-[640px] lg:max-w-[720px]">
              <OnboardingProgress />
              <div className="mt-6 md:mt-8">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
