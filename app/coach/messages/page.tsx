import { Suspense } from 'react'
import { CoachMessagesPageContent } from './MessagesPageContent'

export default function CoachMessagesPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2 lg:p-8">
      <Suspense fallback={<p className="text-sm text-[var(--color-muted)]">Loading messages…</p>}>
        <CoachMessagesPageContent />
      </Suspense>
    </main>
  )
}
