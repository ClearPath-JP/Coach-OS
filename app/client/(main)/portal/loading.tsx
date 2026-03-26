import { Skeleton } from '@/components/ui/Skeleton'

export default function PortalLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
      <Skeleton className="h-20 w-full rounded-[var(--radius-lg)]" />
      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[160px] w-full rounded-xl" />
        ))}
      </div>
      <div className="flex w-full gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-[60px] min-w-0 flex-1 rounded-[var(--radius-md)]" />
        ))}
      </div>
    </main>
  )
}
