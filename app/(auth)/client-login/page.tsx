import { AnimatedLoginPage } from '@/components/auth/AnimatedLoginPage'
import { ClientLoginCard } from '@/components/auth/ClientLoginCard'

/**
 * Client portal login — same aurora shell as coach login (public).
 */
export default function ClientLoginPage() {
  return (
    <AnimatedLoginPage layout="fullscreen">
      <main aria-labelledby="client-login-heading">
        <ClientLoginCard />
      </main>
    </AnimatedLoginPage>
  )
}
