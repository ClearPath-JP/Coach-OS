import { Suspense } from 'react'
import { AuthBrandedLeftPanel } from '@/components/auth/AuthBrandedLeftPanel'
import { AuthWordmark } from '@/components/auth/AuthWordmark'
import { DevAuthToolbar } from '@/components/auth/DevAuthToolbar'
import { LoginForm } from './LoginForm'

/**
 * Sign-in — public; rate-limited in proxy. Split layout: brand story (lg+) + focused form (web.dev: clear labels, autocomplete, recovery links).
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-screen md:min-h-0 lg:grid-cols-[52fr_48fr]">
      <aside className="hidden lg:contents" aria-label="ClearPath Coach OS">
        <AuthBrandedLeftPanel variant="coach-login-light" />
      </aside>

      <main
        id="login-main"
        aria-labelledby="login-heading"
        className="relative flex flex-col justify-center bg-[var(--bg-app)] px-6 py-12 sm:px-12 md:min-h-screen md:overflow-y-auto lg:py-10"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[132px] border-b border-white/10 md:hidden"
          style={{
            background:
              'linear-gradient(155deg, #041a33 0%, #082952 28%, #0B2D5E 55%, #0d47a1 88%, #115293 100%)',
          }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center pt-2 md:hidden">
            <AuthWordmark
              variant="banner"
              tone="onDark"
              className="!text-[1.4rem] sm:!text-[1.55rem]"
            />
          </div>

          <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] p-8 md:border-0 md:bg-transparent md:p-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-quaternary)]">Sign in</p>
            <h1
              id="login-heading"
              className="mt-1 text-[26px] font-medium leading-tight tracking-[-0.03em] text-[var(--text-primary)]"
            >
              Welcome back
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">
              Coaches and clients use this page — we&apos;ll send you to the right place after you sign in.
            </p>

            <div className="mt-8">
              <DevAuthToolbar />
              <Suspense
                fallback={
                  <div className="h-48 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-muted)]" aria-hidden />
                }
              >
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
