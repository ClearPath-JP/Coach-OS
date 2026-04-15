import { Card } from '@/components/ui/Card'

export default function CoachProgramsLoading() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--border-default)]" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} variant="flat" padding="lg" className="h-[220px] animate-pulse border-[var(--border-default)]" />
        ))}
      </div>
    </main>
  )
}
