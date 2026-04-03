import { AuthBrandWordmark } from '@/components/auth/AuthBrandWordmark'

/**
 * Minimal in-card wordmark (light surfaces).
 */
export function AuthPremiumCardHeader() {
  return (
    <div className="mb-8">
      <AuthBrandWordmark tone="on-light" size="lg" />
    </div>
  )
}
