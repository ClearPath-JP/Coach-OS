import { Card } from '@/components/ui/Card'

export default function CoachScheduleLoading() {
  return (
    <main className="min-h-screen space-y-6 p-4 md:p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="hidden min-h-[70vh] gap-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card variant="raised" padding="lg" className="h-[78vh]">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-border)]" />
            ))}
          </div>
        </Card>
        <Card variant="raised" padding="lg" className="min-h-[70vh]">
          <div className="mb-3 flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--color-border)]" />
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--color-border)]" />
          </div>
          <div className="h-[60vh] animate-pulse rounded-lg bg-[var(--color-border)]" />
        </Card>
      </div>
      <div className="space-y-4 lg:hidden">
        <div className="h-32 animate-pulse rounded-xl bg-[var(--color-border)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--color-border)]" />
      </div>
    </main>
  )
}
