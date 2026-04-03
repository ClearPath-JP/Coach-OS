import { Suspense } from 'react'
import Link from 'next/link'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { AuthPremiumCardHeader } from '@/components/auth/AuthPremiumCardHeader'
import { SignupForm } from '@/app/(auth)/signup/SignupForm'

export function SignupCard() {
  return (
    <AuthPremiumCard className="login-premium-card--minimal">
      <AuthPremiumCardHeader />
      <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.03em] text-[#0A1929]">
        Create account
      </h1>
      <p className="mb-8 mt-1.5 text-[14px] leading-relaxed text-[#5B7FA6]">
        Free trial — no credit card required.
      </p>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-[12px] bg-[#E8F1F9]" aria-hidden />}
      >
        <SignupForm />
      </Suspense>
      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E8F1F9',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '14px', color: '#5B7FA6' }}>Already have an account?</span>{' '}
        <Link href="/login" className="font-medium hover:underline" style={{ color: '#3B9EE8', fontSize: '14px' }}>
          Sign in
        </Link>
      </div>
    </AuthPremiumCard>
  )
}
