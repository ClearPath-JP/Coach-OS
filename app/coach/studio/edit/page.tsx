import { StudioEditor } from '../StudioEditor'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { ComingSoon } from '@/components/ComingSoon'

export const dynamic = 'force-dynamic'

export default async function EditPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  if (!isFeatureEnabled('studio')) return <ComingSoon title="Studio" />
  const { project } = await searchParams
  if (!project) {
    const { redirect } = await import('next/navigation')
    redirect('/coach/studio/projects')
  }
  return <StudioEditor projectId={project!} />
}
