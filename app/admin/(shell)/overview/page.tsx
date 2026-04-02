import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AdminOverviewActivityFeed } from '@/components/admin/AdminOverviewActivityFeed'
import { AdminOverviewCoachAccordion } from '@/components/admin/AdminOverviewCoachAccordion'
import { AdminPlatformHealthCard } from '@/components/admin/AdminPlatformHealthCard'
import { mailtoInactiveCoachCheckIn, mailtoPastDueBilling } from '@/lib/admin-attention-mailto'
import { fetchAdminOverviewPayload } from '@/lib/admin-overview-data'
import { logAdminAudit } from '@/lib/admin'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase-server'

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function trendLine(pct: number | null, comparedTo: string): string {
  if (pct == null) return 'No prior period to compare'
  if (pct === 0) return `Flat ${comparedTo}`
  const up = pct > 0
  const arrow = up ? '↑' : '↓'
  return `${arrow} ${Math.abs(pct)}% ${comparedTo}`
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isPlatformAdmin(supabase, user))) redirect('/admin/not-authorized')

  const service = createServiceClient()
  const data = await fetchAdminOverviewPayload(service)

  void logAdminAudit({
    action: 'admin.overview.read',
    userId: user.id,
    metadata: { source: 'server_component', workspaces: data.workspaces.length },
  })

  const coachTrend = trendLine(data.totals.coachesTrendPct, 'vs last month')
  const clientTrend = trendLine(data.totals.clientsTrendPct, 'vs prior week')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Business health at a glance — coaches, clients, revenue, and platform status.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Coaches</p>
              <p className="mt-1 text-3xl font-semibold text-blue-600">{data.totals.coaches}</p>
              <p className="mt-1 text-sm text-slate-600">
                {data.totals.newWorkspacesThisMonth} new this month
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{coachTrend}</p>
            </div>
            <span className="text-2xl text-blue-500" aria-hidden>
              🏢
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Clients</p>
              <p className="mt-1 text-3xl font-semibold text-emerald-600">{data.totals.clients}</p>
              <p className="mt-1 text-sm text-slate-600">
                {data.totals.activeClientsThisWeek} active this week
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{clientTrend}</p>
            </div>
            <span className="text-2xl text-emerald-600" aria-hidden>
              👥
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 border-l-4 border-l-teal-500 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Monthly revenue</p>
              <p className="mt-1 text-3xl font-semibold text-teal-700">
                {money(data.totals.monthlyRevenueCents)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {data.totals.paymentsThisMonthCount} payments recorded
              </p>
            </div>
            <span className="text-2xl text-teal-600" aria-hidden>
              $
            </span>
          </div>
        </div>

        <AdminPlatformHealthCard
          initialOk={data.platformHealthOk}
          initialCheckedAt={data.healthCheckedAt}
        />
      </div>

      {data.attentionItems.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-medium text-amber-950">Needs attention</h2>
          <ul className="mt-3 space-y-3">
            {data.attentionItems.map((item, idx) => {
              if (item.type === 'past_due') {
                return (
                  <li
                    key={`pd-${item.workspaceId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/90 px-3 py-2"
                  >
                    <p className="text-sm text-slate-800">
                      ⚠️ <strong>{item.workspaceName}</strong> subscription is past due
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.coachEmail ? (
                        <a
                          href={mailtoPastDueBilling({
                            coachEmail: item.coachEmail,
                            workspaceName: item.workspaceName,
                          })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                        >
                          Email coach
                        </a>
                      ) : null}
                      <Link
                        href={`/admin/coaches/${item.workspaceId}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                      >
                        Resolve
                      </Link>
                    </div>
                  </li>
                )
              }
              if (item.type === 'inactive_coach') {
                return (
                  <li
                    key={`in-${item.workspaceId}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/90 px-3 py-2"
                  >
                    <p className="text-sm text-slate-800">
                      💤 <strong>{item.workspaceName}</strong> hasn&apos;t been active in {item.daysInactive} days
                    </p>
                    <a
                      href={
                        item.coachEmail
                          ? mailtoInactiveCoachCheckIn({
                              coachEmail: item.coachEmail,
                              workspaceName: item.workspaceName,
                              daysInactive: item.daysInactive,
                            })
                          : 'mailto:'
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Email coach
                    </a>
                  </li>
                )
              }
              return (
                <li
                  key={`fl-${item.label}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200/80 bg-white/90 px-3 py-2"
                >
                  <p className="text-sm text-slate-800">
                    🚨 Multiple failed logins for <strong>{item.label}</strong> ({item.count} today)
                  </p>
                  <Link
                    href={`/admin/audit?${new URLSearchParams({
                      q: item.label,
                      category: 'security',
                    }).toString()}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    View audit log
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(320px,100%)]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-slate-900">Coaches and their clients</h2>
            <Link href="/admin/coaches" className="text-xs font-medium text-blue-600 hover:underline">
              All coaches
            </Link>
          </div>
          <AdminOverviewCoachAccordion
            workspaces={data.workspaces}
            clientsByWorkspace={data.clientsByWorkspace}
          />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <AdminOverviewActivityFeed events={data.recentActivity} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-900">Recent signups</h2>
          <ul className="mt-3 space-y-2">
            {data.recentSignups.map((r) => (
              <li
                key={r.workspaceId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.workspaceName}</p>
                  <p className="text-xs text-slate-500">{r.email}</p>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {r.plan}
                  </span>
                  <p className="text-xs text-slate-400">{new Date(r.joined).toLocaleDateString()}</p>
                </div>
                <Link href={`/admin/coaches/${r.workspaceId}`} className="text-xs font-medium text-blue-600 hover:underline">
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-slate-900">Recent payments</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {data.recentPayments.map((p, i) => (
              <li key={`${p.workspaceId}-${p.paymentDate}-${i}`} className="flex flex-wrap justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.workspaceName}</p>
                  <p className="text-xs text-slate-500">
                    {p.method} · {p.paymentDate}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{money(p.amountCents)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
            Total this week: <span className="font-semibold">{money(data.paymentsWeekTotalCents)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
