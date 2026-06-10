import { Skeleton } from '@/components/ui/Skeleton'

/** Ink-bordered, hard-shadowed Arcade shell to skeleton inside. */
function Tile({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={`rounded-[16px] border-[3px] border-[var(--border-default)] bg-[var(--bg-subtle)] shadow-[var(--shadow-sm)] ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

export default function CoachDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40 rounded-full" />
        <Skeleton className="h-9 w-[18rem] max-w-[80%] rounded-[8px]" />
        <Skeleton className="h-4 w-56 rounded-full" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Tile key={i} className="p-5">
            <Skeleton className="mb-3 h-3 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-[6px]" />
            <Skeleton className="mt-3 h-3 w-24 rounded-full" />
          </Tile>
        ))}
      </div>

      {/* Main + side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Tile className="p-5">
          <Skeleton className="mb-5 h-5 w-28 rounded-[6px]" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 rounded-[12px] border-[3px] border-[var(--border-default)] px-4 py-3"
              >
                <Skeleton className="size-[54px] shrink-0 rounded-[10px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-[45%] rounded-full" />
                  <Skeleton className="h-3 w-[30%] rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </Tile>
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <Tile key={i} className="p-5">
              <Skeleton className="mb-4 h-5 w-24 rounded-[6px]" />
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-10 w-full rounded-[10px]" />
                ))}
              </div>
            </Tile>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Tile key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="size-10 shrink-0 rounded-[10px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </Tile>
        ))}
      </div>
    </div>
  )
}
