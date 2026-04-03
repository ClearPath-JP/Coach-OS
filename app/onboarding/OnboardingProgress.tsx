'use client'

import { usePathname } from 'next/navigation'

const STEPS = [
  { label: 'Workspace', num: 1, hint: 'Brand your practice' },
  { label: 'Focus', num: 2, hint: 'Shape your dashboard' },
  { label: 'Client', num: 3, hint: 'Optional first invite' },
  { label: 'Launch', num: 4, hint: 'Pick your first move' },
] as const

/**
 * Step indicator with labels — display only (complete steps in order).
 */
export function OnboardingProgress() {
  const pathname = usePathname()
  const step =
    pathname === '/onboarding'
      ? 1
      : pathname === '/onboarding/step-2'
        ? 2
        : pathname === '/onboarding/step-3'
          ? 3
          : pathname === '/onboarding/step-4'
            ? 4
            : 1

  const activeMeta = STEPS.find((s) => s.num === step)
  const pct = Math.round((step / STEPS.length) * 100)

  return (
    <nav className="w-full" aria-label="Onboarding progress">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-[13px] text-[var(--text-tertiary)]">
          <span className="font-semibold text-[var(--text-primary)]">Step {step} of {STEPS.length}</span>
          <span aria-live="polite">{pct}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding ${pct} percent complete`}
        >
          <div
            className="h-full rounded-full bg-[var(--cp-accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="relative mx-auto max-w-[640px]">
        <div
          className="pointer-events-none absolute left-[12%] right-[12%] top-[13px] hidden h-0.5 sm:block"
          style={{
            background: 'linear-gradient(90deg, var(--accent-muted), var(--border-default), var(--accent-muted))',
          }}
          aria-hidden
        />
        <ol className="relative flex flex-wrap items-start justify-center gap-2 sm:gap-1">
          {STEPS.map((s, i) => {
            const active = s.num === step
            const done = s.num < step
            return (
              <li key={s.num} className="flex flex-1 flex-col items-center sm:min-w-0 sm:flex-initial">
                {i > 0 ? (
                  <span className="my-2 hidden h-8 w-px bg-[var(--border-default)] sm:hidden" aria-hidden />
                ) : null}
                <div
                  className={`flex w-full flex-col items-center gap-1.5 rounded-2xl px-2 py-2 sm:w-auto sm:flex-row sm:gap-2 sm:rounded-full sm:px-3 sm:py-1.5 ${
                    active
                      ? 'bg-[var(--accent-light)] text-[var(--cp-accent)] ring-1 ring-[var(--cp-accent)]/20'
                      : done
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active
                        ? 'bg-[var(--cp-accent)] text-[var(--text-on-accent)] shadow-sm'
                        : done
                          ? 'bg-[var(--accent-muted)] text-[var(--cp-accent)]'
                          : 'border border-[var(--border-default)] bg-[var(--cp-offwhite)] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {done ? '✓' : s.num}
                  </span>
                  <div className="min-w-0 text-center sm:text-left">
                    <span className="block text-[11px] font-semibold sm:inline sm:text-[12px]">{s.label}</span>
                    {active ? (
                      <span className="mt-0.5 block text-[10px] font-normal leading-tight text-[var(--text-tertiary)] sm:hidden">
                        {s.hint}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {activeMeta ? (
        <p className="mt-4 text-center text-[13px] text-[var(--text-secondary)] sm:mt-5">
          <span className="text-[var(--text-tertiary)]">{activeMeta.hint}</span>
        </p>
      ) : null}
    </nav>
  )
}
