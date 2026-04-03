'use client'

import dynamic from 'next/dynamic'

const ProgramEditorContent = dynamic(
  () => import('./ProgramEditorContent').then((m) => m.ProgramEditorContent),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" aria-hidden />
    ),
  }
)

export function ProgramEditorPageClient({ programId }: { programId: string }) {
  return (
    <main className="flex min-h-0 min-h-screen flex-1 flex-col">
      <ProgramEditorContent programId={programId} />
    </main>
  )
}
