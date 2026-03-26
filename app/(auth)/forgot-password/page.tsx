import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * Forgot password — public; rate-limited in proxy (30/min per IP).
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface)] p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Reset your password</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  )
}
