import { AnimatedLoginPage } from '@/components/auth/AnimatedLoginPage'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { AuthPremiumCardHeader } from '@/components/auth/AuthPremiumCardHeader'
import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * Forgot password — aurora shell + glass card (public; rate-limited in proxy).
 */
export default function ForgotPasswordPage() {
  return (
    <AnimatedLoginPage>
      <main aria-label="Reset password">
        <AuthPremiumCard>
          <AuthPremiumCardHeader />
          <ForgotPasswordForm />
        </AuthPremiumCard>
      </main>
    </AnimatedLoginPage>
  )
}
