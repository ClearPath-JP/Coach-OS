import { isFeatureEnabled } from '@/lib/feature-flags'
import { ComingSoon } from '@/components/ComingSoon'
import { PromotePageContent } from './PromotePageContent'

export default function CoachPromotePage() {
  if (!isFeatureEnabled('promote')) return <ComingSoon title="Promote" />
  return <PromotePageContent />
}
