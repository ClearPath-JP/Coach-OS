import { Suspense } from 'react'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { AuthPremiumCardHeader } from '@/components/auth/AuthPremiumCardHeader'
import { ClientLoginForm } from '@/app/(auth)/client-login/ClientLoginForm'

export function ClientLoginCard() {
  return (
    <AuthPremiumCard className="login-premium-card--minimal">
      <AuthPremiumCardHeader />
      <h1
        id="client-login-heading"
        className="text-[1.375rem] font-semibold leading-tight tracking-[-0.03em] text-[#0A1929]"
      >
        Sign in
      </h1>
      <p className="mb-8 mt-1.5 text-[14px] leading-relaxed text-[#5B7FA6]">Your coaching portal.</p>
      <Suspense
        fallback={<div className="h-40 animate-pulse rounded-[12px] bg-[#E8F1F9]" aria-hidden />}
      >
        <ClientLoginForm />
      </Suspense>
    </AuthPremiumCard>
  )
}
