'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DataTable } from '@/components/ui/DataTable'

const AdminRevenueCharts = dynamic(
  () => import('@/components/admin/AdminRevenueCharts').then((m) => m.AdminRevenueCharts),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[200px] items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-sm text-slate-500"
        aria-busy
      >
        Loading charts…
      </div>
    ),
  }
)

type RevenueData = {
  byPlan: Record<string, { coaches: number; mrrCents: number }>
  totalMrrCents: number
  totalArrCents: number
  monthlyLast6: Array<{ month: string; label: string; totalCents: number }>
  methodBreakdown: Array<{ method: string; count: number; cents: number; percent: number }>
  recentPayments: Array<{ coach: string; client: string; amountCents: number; method: string; date: string }>
  recentSubscriptions: Array<{ coach: string; plan: string; status: string; created_at: string }>
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)

  useEffect(() => {
    void fetch('/api/admin/revenue')
      .then((r) => r.json())
      .then((json) => setData(json.data ?? null))
  }, [])

  if (!data) {
    return <p className="text-sm text-slate-500">Loading revenue…</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Revenue</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Payments and subscription activity over time. <strong>MRR</strong> here is a rollup from stored subscription
          data — compare with{' '}
          <Link href="/admin/subscriptions" className="font-medium text-blue-700 hover:underline">
            Subscriptions
          </Link>{' '}
          for per-plan coach counts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['free', 'starter', 'pro', 'scale'] as const).map((plan) => (
          <div key={plan} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{plan}</p>
            <p className="mt-1 text-sm text-slate-700">{data.byPlan[plan]?.coaches ?? 0} coaches</p>
            <p className="text-lg font-semibold text-slate-900">{money(data.byPlan[plan]?.mrrCents ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-semibold text-slate-900">Total MRR: {money(data.totalMrrCents)}</p>
        <p className="text-sm text-slate-600">Total ARR: {money(data.totalArrCents)}</p>
      </div>

      <AdminRevenueCharts monthlyLast6={data.monthlyLast6} methodBreakdown={data.methodBreakdown} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent payments</h2>
        <DataTable
          rows={data.recentPayments}
          emptyTitle="No payments"
          emptyDescription="No payment records in range."
          columns={[
            { key: 'coach', header: 'Coach', render: (r) => r.coach },
            { key: 'client', header: 'Client', render: (r) => r.client },
            { key: 'amount', header: 'Amount', render: (r) => money(r.amountCents) },
            { key: 'method', header: 'Method', render: (r) => r.method },
            { key: 'date', header: 'Date', render: (r) => r.date },
          ]}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent subscriptions</h2>
        <DataTable
          rows={data.recentSubscriptions}
          emptyTitle="No subscriptions"
          emptyDescription="No subscription rows."
          columns={[
            { key: 'coach', header: 'Coach', render: (r) => r.coach },
            { key: 'plan', header: 'Plan', render: (r) => r.plan },
            { key: 'status', header: 'Status', render: (r) => r.status },
            { key: 'date', header: 'Date', render: (r) => new Date(r.created_at).toLocaleString() },
          ]}
        />
      </div>
    </div>
  )
}
