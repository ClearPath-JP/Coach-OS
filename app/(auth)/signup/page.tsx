import { Suspense } from 'react'
import { AuthBrandedLeftPanel } from '@/components/auth/AuthBrandedLeftPanel'
import { SignupForm } from './SignupForm'

/**
 * Coach signup — public; API rate-limited (5 per 15 min per IP).
 */
export default function SignupPage() {
  return (
    <div className="grid min-h-screen lg:min-h-0 lg:grid-cols-[55fr_45fr]">
      <AuthBrandedLeftPanel
        headline={
          <>
            Start strong with
            <br />
            ClearPath Coach OS.
          </>
        }
        subtext="Free trial, no credit card — clients, scheduling, programs, and payments in one workspace."
      />
      <div className="flex flex-col justify-center bg-[var(--color-bg)] p-6 sm:p-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="text-[22px] font-medium leading-[var(--leading-heading)] text-[var(--color-text-primary)]">
              ClearPath
            </div>
            <div className="text-[12px] font-normal tracking-[var(--tracking-uppercase)] text-[var(--color-accent)]">
              Coach OS
            </div>
          </div>
          <h1 className="text-[22px] font-medium leading-[var(--leading-heading)] text-[var(--color-text-primary)]">
            Start your free trial
          </h1>
          <p className="mt-1 mb-8 text-[15px] font-normal leading-[var(--leading-body)] text-[var(--color-success)]">
            14 days free · No credit card required
          </p>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-[var(--color-surface)]" />}>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
