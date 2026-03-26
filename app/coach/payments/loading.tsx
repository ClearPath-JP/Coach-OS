import { Card } from '@/components/ui/Card'

export default function CoachPaymentsLoading() {
  return (
    <main className="min-h-screen space-y-6 p-4 md:p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} variant="raised" padding="lg" className="min-h-[96px]">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-border)]" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-[var(--color-border)]" />
          </Card>
        ))}
      </div>
      <Card variant="raised" padding="lg" className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)] p-4">
          <div className="h-5 w-full max-w-md animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="h-4 flex-1 animate-pulse rounded bg-[var(--color-border)]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-border)]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      </Card>
    </main>
  )
}
