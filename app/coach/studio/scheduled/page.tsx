import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { StudioTabs } from '../StudioTabs'
import { ScheduledContent } from './ScheduledContent'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ComingSoon } from '@/components/ComingSoon'

export const dynamic = 'force-dynamic'

export default function ScheduledPage() {
  if (!isFeatureEnabled('studio')) return <ComingSoon title="Studio" />
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader title="Studio" icon={<Icon name="studio" />} />
      <StudioTabs />
      <ScheduledContent />
    </div>
  )
}
