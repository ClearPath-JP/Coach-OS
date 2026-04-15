import { Suspense } from 'react'
import { CoachMessagesPageContent } from './MessagesPageContent'

export default function CoachMessagesPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<p className="p-4 text-[13px] text-[var(--text-tertiary)]">Loading messages…</p>}>
        <CoachMessagesPageContent />
      </Suspense>
    </main>
  )
}
