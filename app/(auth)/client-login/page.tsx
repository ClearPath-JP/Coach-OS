import { Suspense } from 'react'
import { ClientLoginForm } from './ClientLoginForm'

/**
 * Client portal login — public; distinct from coach login.
 */
export default function ClientLoginPage() {
  return (
    <main className="min-h-screen bg-[var(--color-surface)] px-4 py-10">
      <div className="mx-auto w-full max-w-[400px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-card)] sm:p-10">
        <div className="text-center">
          <div className="text-[22px] font-medium leading-[var(--leading-heading)] text-[var(--color-text-primary)]">
            ClearPath
          </div>
          <p className="mt-1 text-[13px] leading-[var(--leading-body)] text-[var(--color-text-secondary)]">
            Client Portal
          </p>
        </div>
        <h1 className="mt-8 text-center text-[22px] font-medium leading-[var(--leading-heading)] text-[var(--color-text-primary)]">
          Sign in to your portal
        </h1>
        <p className="mt-2 text-center text-[15px] leading-[var(--leading-body)] text-[var(--color-text-secondary)]">
          Enter the credentials your coach shared with you
        </p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-[var(--color-surface)]" />}>
            <ClientLoginForm />
          </Suspense>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-[400px] text-center text-[12px] leading-[var(--leading-caption)] text-[var(--color-text-secondary)]">
        Powered by ClearPath
      </p>
      <p className="mx-auto mt-3 max-w-[400px] text-center text-[12px] text-[var(--color-text-secondary)]">
        <a href="/terms" className="text-[var(--color-accent)] underline hover:opacity-90">
          Terms of Service
        </a>
        <span className="mx-2 text-[var(--color-border)]" aria-hidden>
          ·
        </span>
        <a href="/privacy" className="text-[var(--color-accent)] underline hover:opacity-90">
          Privacy Policy
        </a>
      </p>
    </main>
  )
}
