import { Skeleton } from '@/components/ui/Skeleton'

function SessionRowSkeleton() {
  return (
    <div className="flex h-[60px] shrink-0 items-center gap-3 rounded-[var(--radius-md)] px-1">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <Skeleton className="h-3.5 w-[55%] max-w-[180px]" />
        <Skeleton className="h-3 w-[40%] max-w-[120px]" />
      </div>
    </div>
  )
}

export default function CoachDashboardLoading() {
  return (
    <main className="flex h-full min-h-0 flex-col gap-3 p-4 lg:h-[calc(100dvh-56px)] lg:max-h-[calc(100dvh-56px)] lg:gap-4 lg:overflow-hidden">
      <div className="flex min-h-0 flex-[2] flex-col gap-3 lg:flex-row lg:gap-4">
        <div className="flex min-h-0 w-full min-w-0 flex-[2] flex-col gap-3">
          <Skeleton className="h-[200px] w-full shrink-0 rounded-[var(--radius-xl)]" />
          <div className="grid min-h-0 shrink-0 grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex min-h-[180px] w-full min-w-0 flex-[1] flex-col rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <SessionRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-[3] flex-col gap-3 lg:flex-row lg:gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="min-h-[200px] w-full min-w-0 flex-1 rounded-[var(--radius-xl)]" />
        ))}
      </div>
    </main>
  )
}
