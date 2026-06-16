import { isFeatureEnabled } from '@/lib/feature-flags'
import { ComingSoon } from '@/components/ComingSoon'
import { CoachLeadsContent } from './CoachLeadsContent'

export default function CoachLeadsPage() {
  if (!isFeatureEnabled('leads')) return <ComingSoon title="Lead Research" />
  return <CoachLeadsContent />
}
