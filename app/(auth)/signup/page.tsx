import { Suspense } from 'react'
import { SignupPageClient } from './SignupPageClient'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[var(--bg-app)]" aria-hidden />}>
      <SignupPageClient />
    </Suspense>
  )
}
