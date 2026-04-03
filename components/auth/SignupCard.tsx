import { Suspense } from 'react'
import Link from 'next/link'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { AuthPremiumCardHeader } from '@/components/auth/AuthPremiumCardHeader'
import { SignupForm } from '@/app/(auth)/signup/SignupForm'

export function SignupCard() {
  return (
    <AuthPremiumCard>
      <AuthPremiumCardHeader />
      <h1
        style={{
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#0A1929',
          marginBottom: '6px',
          lineHeight: 1.2,
        }}
      >
        Create your account
      </h1>
      <p style={{ fontSize: '15px', color: '#5B7FA6', marginBottom: '28px', lineHeight: 1.5 }}>
        Start your free trial. No credit card required.
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
