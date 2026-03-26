'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'

const ProgramEditorContent = dynamic(
  () => import('./ProgramEditorContent').then((m) => m.ProgramEditorContent),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] animate-pulse rounded-xl bg-[var(--color-surface)]" aria-hidden />
    ),
  }
)

export function ProgramEditorPageClient({ programId }: { programId: string }) {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/coach/programs"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          ← Programs
        </Link>
      </div>
      <ProgramEditorContent programId={programId} />
    </main>
  )
}
