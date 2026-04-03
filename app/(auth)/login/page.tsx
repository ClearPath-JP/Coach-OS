import { AnimatedLoginPage } from '@/components/auth/AnimatedLoginPage'
import { LoginCard } from '@/components/auth/LoginCard'

/**
 * Coach sign-in — aurora background + centered glass card (public; rate-limited in proxy).
 */
export default function LoginPage() {
  return (
    <AnimatedLoginPage>
      <main id="login-main" aria-labelledby="login-heading">
        <LoginCard />
      </main>
    </AnimatedLoginPage>
  )
}
