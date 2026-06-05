import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { ProjectsContent } from './ProjectsContent'

export const dynamic = 'force-dynamic'

export default function ProjectsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader title="Studio" icon={<Icon name="studio" />} />
      <ProjectsContent />
    </div>
  )
}
