import { Skeleton } from '@/components/ui/Skeleton'

function ConversationRowSkeleton() {
  return (
    <li className="flex min-h-[64px] items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <Skeleton className="h-4 w-[65%] max-w-[200px]" />
        <Skeleton className="h-3 w-[90%] max-w-[260px]" />
      </div>
    </li>
  )
}

export default function CoachMessagesLoading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      <div className="flex min-h-0 min-h-[calc(100dvh-7rem)] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] lg:min-h-[calc(100dvh-3.5rem)] lg:flex-row">
        <div className="flex h-full min-h-[320px] w-full flex-col border-[var(--color-border)] bg-[var(--color-surface)] lg:w-1/3 lg:border-r lg:border-b-0">
          <div className="border-b border-[var(--color-border)] px-4 py-4">
            <Skeleton className="h-7 w-32 rounded-md" />
          </div>
          <ul className="flex-1 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <ConversationRowSkeleton key={i} />
            ))}
          </ul>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 lg:flex lg:w-2/3">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-4 w-56 max-w-full rounded-md" />
        </div>
      </div>
    </main>
  )
}
