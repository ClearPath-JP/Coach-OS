import { Card } from '@/components/ui/Card'

export default function CoachProgramsLoading() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} variant="flat" padding="lg" className="h-[220px] animate-pulse border-[var(--color-border)]" />
        ))}
      </div>
    </main>
  )
}
