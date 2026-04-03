import { AnimatedLoginPage } from '@/components/auth/AnimatedLoginPage'
import { SignupCard } from '@/components/auth/SignupCard'

/**
 * Coach signup — same split auth shell as login (public; API rate-limited).
 */
export default function SignupPage() {
  return (
    <AnimatedLoginPage>
      <main aria-label="Create coach account">
        <SignupCard />
      </main>
    </AnimatedLoginPage>
  )
}
