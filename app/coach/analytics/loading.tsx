import { Card } from '@/components/ui/Card'

export default function CoachAnalyticsLoading() {
  return (
    <main className="min-h-screen space-y-6 p-4 md:p-6">
      <div className="h-8 w-56 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} variant="raised" padding="lg" className="min-h-[88px]">
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-border)]" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-[var(--color-border)]" />
          </Card>
        ))}
      </div>
      <Card variant="raised" padding="lg" className="min-h-[320px]">
        <div className="h-6 w-40 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="mt-6 h-[240px] w-full animate-pulse rounded-lg bg-[var(--color-border)]" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="raised" padding="lg" className="min-h-[200px]">
          <div className="h-5 w-32 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--color-border)]" />
            ))}
          </div>
        </Card>
        <Card variant="raised" padding="lg" className="min-h-[200px]">
          <div className="h-5 w-36 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="mt-4 h-40 animate-pulse rounded-lg bg-[var(--color-border)]" />
        </Card>
      </div>
    </main>
  )
}
