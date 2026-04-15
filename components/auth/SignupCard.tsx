import { Suspense } from 'react'
import Link from 'next/link'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { SignupForm } from '@/app/(auth)/signup/SignupForm'

export function SignupCard() {
  return (
    <AuthPremiumCard className="login-premium-card--minimal">
      <h1 className="text-[1.5rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)]">
        Start your coaching business
      </h1>
      <p className="mb-8 mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
        Everything you need to run and grow your practice.
      </p>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-muted)]" aria-hidden />}
      >
        <SignupForm />
      </Suspense>
      <div className="mt-6 border-t border-[var(--border-default)] pt-6 text-center">
        <span className="text-[14px] text-[var(--text-secondary)]">Already have an account?</span>{' '}
        <Link href="/login" className="text-[14px] font-medium text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </div>
    </AuthPremiumCard>
  )
}
