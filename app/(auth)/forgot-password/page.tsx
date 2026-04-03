import { AnimatedLoginPage } from '@/components/auth/AnimatedLoginPage'
import { AuthPremiumCard } from '@/components/auth/AuthPremiumCard'
import { AuthPremiumCardHeader } from '@/components/auth/AuthPremiumCardHeader'
import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * Forgot password — split auth shell (public; rate-limited in proxy).
 */
export default function ForgotPasswordPage() {
  return (
    <AnimatedLoginPage>
      <main aria-label="Reset password">
        <AuthPremiumCard className="login-premium-card--minimal">
          <AuthPremiumCardHeader />
          <ForgotPasswordForm />
        </AuthPremiumCard>
      </main>
    </AnimatedLoginPage>
  )
}
