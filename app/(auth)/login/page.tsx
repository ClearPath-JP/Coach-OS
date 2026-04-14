import { Suspense } from 'react'
import { DualRoleLoginPage } from './DualRoleLoginPage'

/**
 * Dual-role coach / student sign-in (design system Phase 2).
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[var(--bg-app)]" aria-hidden />
      }
    >
      <DualRoleLoginPage />
    </Suspense>
  )
}
