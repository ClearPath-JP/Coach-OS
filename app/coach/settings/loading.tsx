import { Card } from '@/components/ui/Card'

export default function CoachSettingsLoading() {
  return (
    <main className="min-h-screen space-y-6 p-4 md:p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-[var(--color-border)]" />
        ))}
      </div>
      <Card variant="raised" padding="lg" className="max-w-3xl space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--color-border)]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--color-border)]" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-[var(--color-border)]" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-[var(--color-border)]" />
      </Card>
    </main>
  )
}
