import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type ErrorRow = {
  id: string
  role: string | null
  route_path: string | null
  error_message: string
  error_stack: string | null
  user_email: string | null
  workspace_id: string | null
  client_meta: Record<string, unknown> | null
  created_at: string
}

function formatWhen(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

function TypeBadge({ row }: { row: ErrorRow }) {
  const isServer =
    row.role === 'server' || (row.client_meta as { source?: string } | null)?.source === 'server'
  const label = isServer ? 'server' : (row.role ?? 'client')

  if (isServer) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
        server
      </span>
    )
  }
  if (label === 'coach') {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
        coach
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
      {label}
    </span>
  )
}

export default async function AdminErrorsPage() {
  const service = createServiceClient()

  const { data, error } = await service
    .from('frontend_error_logs')
    .select('id,role,route_path,error_message,error_stack,user_email,workspace_id,client_meta,created_at')
    .order('created_at', { ascending: false })
    .limit(150)

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Errors</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm text-red-700">Could not load errors: {error.message}</p>
        </div>
      </div>
    )
  }

  const rows = (data ?? []) as ErrorRow[]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Errors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent app + server errors. Newest first.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-white px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">No errors recorded 🎉</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-default)] bg-white">
          {/* Table header */}
          <div className="hidden border-b border-[var(--border-default)] px-5 py-2 sm:grid sm:grid-cols-[140px_90px_160px_1fr_160px] sm:gap-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">When</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Type</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Route</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Message</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Who</span>
          </div>

          <div className="divide-y divide-[var(--border-default)]">
            {rows.map((row) => (
              <div key={row.id} className="px-5 py-3 hover:bg-[var(--bg-subtle)]/50">
                {/* Mobile: stacked; Desktop: grid */}
                <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[140px_90px_160px_1fr_160px] sm:items-start sm:gap-4">
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {formatWhen(row.created_at)}
                  </span>
                  <span>
                    <TypeBadge row={row} />
                  </span>
                  <span className="truncate text-[12px] text-[var(--text-secondary)]" title={row.route_path ?? ''}>
                    {row.route_path ? truncate(row.route_path, 24) : '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--text-primary)]">
                      {truncate(row.error_message, 120)}
                    </p>
                    {row.error_stack && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                          stack
                        </summary>
                        <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--bg-subtle)] p-2 text-xs text-[var(--text-secondary)]">
                          {row.error_stack}
                        </pre>
                      </details>
                    )}
                  </div>
                  <span className="truncate text-[12px] text-[var(--text-muted)]" title={row.user_email ?? ''}>
                    {row.user_email ? truncate(row.user_email, 28) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
