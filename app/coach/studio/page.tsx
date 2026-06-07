import { redirect } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ComingSoon } from '@/components/ComingSoon'

export default function StudioIndex() {
  if (!isFeatureEnabled('studio')) return <ComingSoon title="Studio" />
  redirect('/coach/studio/projects')
}
