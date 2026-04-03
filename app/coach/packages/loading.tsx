import { Card } from '@/components/ui/Card'

export default function CoachPackagesLoading() {
  return (
    <main className="flex min-h-0 min-h-screen flex-1 flex-col">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-[var(--border-default)]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} variant="raised" padding="lg" className="h-[180px] animate-pulse" />
        ))}
      </div>
    </main>
  )
}
