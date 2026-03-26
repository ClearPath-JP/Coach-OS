import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'

function ClientCardSkeleton() {
  return (
    <Card variant="flat" padding="lg" className="h-[100px] border-[0.5px] border-[var(--color-border)]">
      <div className="flex h-full items-center gap-4">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <Skeleton className="h-4 w-3/4 max-w-[200px]" />
          <Skeleton className="h-3 w-1/2 max-w-[160px]" />
        </div>
      </div>
    </Card>
  )
}

export default function CoachClientsLoading() {
  return (
    <main className="min-h-screen p-6">
      <Skeleton className="mb-4 h-10 w-full rounded-[var(--radius-md)]" />
      <div className="mb-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 w-20 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ClientCardSkeleton key={i} />
        ))}
      </div>
    </main>
  )
}
