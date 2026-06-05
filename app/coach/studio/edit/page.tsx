import { StudioEditor } from '../StudioEditor'

export const dynamic = 'force-dynamic'

export default async function EditPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams
  if (!project) {
    const { redirect } = await import('next/navigation')
    redirect('/coach/studio/projects')
  }
  return <StudioEditor projectId={project!} />
}
