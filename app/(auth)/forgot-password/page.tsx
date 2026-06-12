import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata = { title: 'Reset password', robots: { index: false } }

/**
 * Forgot password — Dojo Arcade identity, matches the login page.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[var(--bg-app)]">
      {/* ═══ TOP BAR ═══ */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="font-[family-name:var(--font-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--ink)]">
          Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
        </div>
        <p className="hidden font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:block">
          Focus. Train. Evolve.
        </p>
      </div>

      {/* ═══ CARD ═══ */}
      <main
        aria-label="Reset password"
        className="relative z-10 mx-4 w-full max-w-[400px] rounded-[18px] border-[3px] border-[var(--ink)] bg-white px-7 py-7 shadow-[6px_6px_0_var(--ink)]"
      >
        <ForgotPasswordForm />
      </main>
    </div>
  )
}
