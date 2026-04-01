'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DataTable } from '@/components/ui/DataTable'

type SubData = {
  mrrByPlan: Record<string, { coaches: number; mrrCents: number }>
  totalMrrCents: number
  totalArrCents: number
  subscriptions: Array<{
    workspaceId: string
    workspaceName: string
    coachEmail: string
    plan: string
    status: string
    started: string
    periodEnd: string | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
  }>
  recentChanges: Array<{ action: string; ip_address: string | null; created_at: string; metadata: unknown }>
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<SubData | null>(null)

  useEffect(() => {
    void fetch('/api/admin/subscriptions')
      .then((r) => r.json())
      .then((json) => setData(json.data ?? null))
  }, [])

  if (!data) return <p className="text-sm text-slate-500">Loading subscriptions…</p>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Subscriptions</h1>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
        {(['free', 'starter', 'pro', 'scale'] as const).map((plan) => (
          <div key={plan} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
            <span className="capitalize text-slate-700">{plan}</span>
            <span className="text-slate-600">
              {data.mrrByPlan[plan]?.coaches ?? 0} coaches = {money(data.mrrByPlan[plan]?.mrrCents ?? 0)}/mo
            </span>
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 font-semibold text-slate-900">
          <span>Total MRR</span>
          <span>{money(data.totalMrrCents)}/mo</span>
        </div>
        <p className="text-slate-600">Total ARR: {money(data.totalArrCents)}/yr</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">All subscriptions</h2>
        <DataTable
          rows={data.subscriptions}
          emptyTitle="No subscriptions"
          emptyDescription="No subscription rows found."
          columns={[
            {
              key: 'ws',
              header: 'Workspace',
              render: (r) => (
                <div>
                  <p className="font-medium text-slate-900">{r.workspaceName}</p>
                  <p className="text-xs text-slate-500">{r.coachEmail}</p>
                </div>
              ),
            },
            { key: 'plan', header: 'Plan', render: (r) => r.plan },
            { key: 'status', header: 'Status', render: (r) => r.status },
            { key: 'started', header: 'Started', render: (r) => new Date(r.started).toLocaleDateString() },
            {
              key: 'period',
              header: 'Period end',
              render: (r) => (r.periodEnd ? new Date(r.periodEnd).toLocaleDateString() : '—'),
            },
            {
              key: 'stripe',
              header: 'Stripe',
              render: (r) => (
                <span className="font-mono text-xs text-slate-600">{r.stripeCustomerId ?? '—'}</span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <Link href={`/admin/coaches/${r.workspaceId}`} className="text-xs font-medium text-blue-600 hover:underline">
                  View
                </Link>
              ),
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recent subscription-related changes</h2>
        <ul className="mt-2 space-y-2 text-xs text-slate-600">
          {data.recentChanges.length === 0 ? (
            <li>No recent events</li>
          ) : (
            data.recentChanges.map((a) => (
              <li key={`${a.action}-${a.created_at}`} className="border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800">{a.action}</span> · {a.ip_address ?? '—'} ·{' '}
                {new Date(a.created_at).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
