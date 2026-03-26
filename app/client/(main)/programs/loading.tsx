import { Card } from '@/components/ui/Card'

export default function ClientProgramsLoading() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="h-8 w-36 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} variant="raised" padding="lg" className="h-[180px] animate-pulse" />
        ))}
      </div>
    </main>
  )
}
