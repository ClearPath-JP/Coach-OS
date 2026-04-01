'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function moneyFromDollars(d: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d)
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B']

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

type Props = {
  monthlyLast6: Array<{ month: string; label: string; totalCents: number }>
  methodBreakdown: Array<{ method: string; count: number; cents: number; percent: number }>
}

export function AdminRevenueCharts({ monthlyLast6, methodBreakdown }: Props) {
  const barData = monthlyLast6.map((m) => ({
    ...m,
    dollars: Math.round(m.totalCents / 100),
  }))

  const pieData = methodBreakdown.filter((m) => m.cents > 0)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Monthly revenue</h2>
        <p className="text-xs text-slate-500">Last 6 months (recorded payments)</p>
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 24, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                formatter={(value) => moneyFromDollars(Number(value ?? 0))}
                labelFormatter={(_, payload) => (payload?.[0]?.payload?.label as string) ?? ''}
              />
              <Bar dataKey="dollars" fill="#0EA5E9" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={entry.month} fill={i === barData.length - 1 ? '#0284C7' : '#38BDF8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          {barData.map((m) => (
            <li key={m.month}>
              <span className="font-medium text-slate-800">{m.label}:</span> {money(m.totalCents)}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Payment methods</h2>
        <p className="text-xs text-slate-500">Share by recorded amount</p>
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="cents"
                nameKey="method"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={96}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={pieData[i]!.method} fill={COLORS[i % COLORS.length] ?? '#64748B'} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(Number(value ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {methodBreakdown.map((m) => (
            <li key={m.method} className="flex justify-between gap-2">
              <span className="capitalize">{m.method.replace('_', ' ')}</span>
              <span>
                {m.percent}% · {money(m.cents)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
