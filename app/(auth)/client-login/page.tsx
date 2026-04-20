'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { ClientLoginForm } from './ClientLoginForm'

/**
 * Client portal login — dark glass card, matches Sensei App identity.
 * No longer uses the old AnimatedLoginPage/light-mode shell.
 */
export default function ClientLoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center bg-[var(--bg-app)] px-4 py-12">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        {/* Subtle radial accent glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(159, 18, 57, 0.08), transparent 70%)',
          }}
        />
        {/* Bottom-left ambient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 60% at 20% 80%, rgba(159, 18, 57, 0.04), transparent 60%)',
          }}
        />
      </div>

      {/* Brand mark — top left */}
      <div className="fixed left-6 top-6 z-20">
        <Link href="/login" className="flex items-center gap-2 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]">
          <span className="text-[15px] font-semibold tracking-wide text-[var(--text-primary)]">
            SENSEI
          </span>
        </Link>
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div
          className="rounded-2xl border border-[var(--border-default)] p-8 sm:p-10"
          style={{
            background: 'rgba(24, 24, 27, 0.6)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(159, 18, 57, 0.06)',
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text-primary)]">
              Student Portal
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-tertiary)]">
              Sign in to access your training.
            </p>
          </div>

          {/* Form */}
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-muted)]" aria-hidden />
            }
          >
            <ClientLoginForm />
          </Suspense>
        </div>

        {/* Footer links — below card */}
        <div className="mt-6 text-center">
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Having trouble? Contact your coach.
          </p>
          <p className="mt-3 text-[12px]">
            <Link
              href="/login"
              className="font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
            >
              Coach? Sign in here &rarr;
            </Link>
          </p>
          <p className="mt-2 text-[12px] text-[var(--text-quaternary)]">
            <Link href="/terms" className="transition-colors hover:text-[var(--text-tertiary)]">
              Terms
            </Link>
            <span className="mx-2" aria-hidden>&middot;</span>
            <Link href="/privacy" className="transition-colors hover:text-[var(--text-tertiary)]">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
