export function AdminOverviewDataSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80"
            aria-hidden
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80" aria-hidden />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(320px,100%)]">
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80" aria-hidden />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80" aria-hidden />
      </div>
    </div>
  )
}
