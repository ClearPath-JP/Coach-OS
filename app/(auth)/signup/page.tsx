import { Suspense } from 'react'
import { SignupPageClient } from './SignupPageClient'

export const metadata = {
  title: 'Get started',
  description: 'Create your Korva coaching account and open your dojo.',
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[var(--bg-app)]" aria-hidden />}>
      <SignupPageClient />
    </Suspense>
  )
}
