/**
 * Immediate shell while overview data loads (avoids blank main panel).
 */
export default function AdminOverviewLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-48 rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-48 rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="h-56 rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-6 h-32 rounded bg-slate-100" />
      </div>
    </div>
  )
}
