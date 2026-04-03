import { Suspense } from 'react'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { AuthPremiumCardHeader } from '@/components/auth/AuthPremiumCardHeader'
import { DevAuthToolbar } from '@/components/auth/DevAuthToolbar'
import { LoginForm } from '@/app/(auth)/login/LoginForm'

/**
 * Coach login — centered glass card on aurora (see `AnimatedLoginPage`).
 */
export function LoginCard() {
  return (
    <AuthPremiumCard>
      <AuthPremiumCardHeader />
      <h1
        id="login-heading"
        style={{
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#0A1929',
          marginBottom: '6px',
          lineHeight: 1.2,
        }}
      >
        Welcome back
      </h1>
      <p style={{ fontSize: '15px', color: '#5B7FA6', marginBottom: '28px', lineHeight: 1.5 }}>
        Sign in to your coaching workspace
      </p>
      <DevAuthToolbar />
      <Suspense
        fallback={<div className="h-48 animate-pulse rounded-[12px] bg-[#E8F1F9]" aria-hidden />}
      >
        <LoginForm />
      </Suspense>
    </AuthPremiumCard>
  )
}
