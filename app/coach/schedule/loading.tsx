export default function CoachScheduleLoading() {
  return (
    <div className="sensei-page">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--border-default)]" />
        <div className="mt-2 h-7 w-52 animate-pulse rounded bg-[var(--border-default)]" />
        <div className="mt-5 flex gap-2">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--border-default)]" />
          <div className="h-9 w-20 animate-pulse rounded-lg bg-[var(--border-default)]" />
          <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--border-default)]" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-[var(--border-default)]" />
        </div>
      </div>
      {/* Calendar skeleton */}
      <div className="hidden min-h-[560px] gap-0 lg:flex">
        <div className="w-[280px] shrink-0 animate-pulse rounded-l-xl bg-[var(--bg-subtle)]" />
        <div className="flex-1 animate-pulse rounded-r-xl bg-[var(--bg-subtle)]" />
      </div>
      <div className="space-y-4 lg:hidden">
        <div className="h-32 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
      </div>
    </div>
  )
}
