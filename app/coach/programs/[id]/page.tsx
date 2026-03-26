import { ProgramEditorPageClient } from './ProgramEditorPageClient'

export default async function CoachProgramEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProgramEditorPageClient programId={id} />
}
