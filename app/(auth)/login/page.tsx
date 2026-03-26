import { Suspense } from 'react'
import { AuthBrandedLeftPanel } from '@/components/auth/AuthBrandedLeftPanel'
import { LoginForm } from './LoginForm'

/**
 * Coach login — public; rate-limited in proxy (30/min per IP).
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-screen md:min-h-0 lg:grid-cols-[55fr_45fr]">
      <AuthBrandedLeftPanel />
      <div className="relative flex flex-col justify-center bg-[var(--bg-app)] px-6 py-12 sm:px-12 md:min-h-screen md:overflow-y-auto lg:py-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[120px] md:hidden"
          style={{
            background: 'linear-gradient(145deg, #1565C0 0%, #2196F3 50%, #64B5F6 100%)',
          }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto w-full max-w-[360px]">
          <div className="mb-10 flex flex-col items-center md:hidden">
            <div className="flex items-center gap-2">
              <div
                className="size-7 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.2)' }}
                aria-hidden
              />
              <div className="text-[18px] font-bold tracking-tight text-white">ClearPath</div>
            </div>
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)]">
            Welcome back
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-tertiary)]">Sign in to your ClearPath account</p>
          <div className="mt-8">
            <Suspense
              fallback={<div className="h-48 skeleton" />}
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
