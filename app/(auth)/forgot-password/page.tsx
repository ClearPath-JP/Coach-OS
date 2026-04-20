import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * Forgot password — dark centered card, matches Combative Alchemy identity.
 */
export default function ForgotPasswordPage() {
  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center px-6 py-10"
      style={{ background: 'var(--bg-app)', fontFamily: 'var(--font-dm-sans), var(--font)' }}
    >
      <main
        aria-label="Reset password"
        className="w-full max-w-[420px] rounded-[12px] border p-8"
        style={{
          background: 'var(--bg-subtle)',
          borderColor: 'var(--border-default)',
        }}
      >
        <ForgotPasswordForm />

        <div className="mt-8 text-center">
          <p
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent-dark)',
              opacity: 0.5,
            }}
          >
            Powered by FoundOS
          </p>
        </div>
      </main>
    </div>
  )
}
