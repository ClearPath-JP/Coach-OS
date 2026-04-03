'use client'

import { format, parseISO } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_STYLES, type PaymentMethodValue } from '@/lib/payment-methods'

const DONUT_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#64748b',
  '#14b8a6',
]

export type AnalyticsChartsChartRow = {
  date: string
  label: string
  total: number
  dollars: number
}

type RevenueProps = {
  chartData: AnalyticsChartsChartRow[]
  tall?: boolean
}

export function AnalyticsRevenueChartCard({ chartData, tall }: RevenueProps) {
  const chartHeight = tall ? 420 : 320
  return (
    <Card variant="raised" padding="lg">
      <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Revenue</h2>
      <div className="w-full min-w-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted)"
              tickFormatter={(v) =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                  Number(v)
                )
              }
            />
            <Tooltip
              formatter={(value) => [
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0)),
                'Revenue',
              ]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as { date?: string } | undefined
                const d = row?.date
                if (!d) return ''
                if (d.length === 7) return format(parseISO(`${d}-01`), 'MMMM yyyy')
                return format(parseISO(d), 'MMMM d, yyyy')
              }}
            />
            <Line
              type="monotone"
              dataKey="dollars"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

type PaymentProps = {
  donutData: { name: string; value: number; key: string }[]
  methodEntries: [string, number][]
  methodTotal: number
}

export function AnalyticsPaymentMethodsChartCard({ donutData, methodEntries, methodTotal }: PaymentProps) {
  return (
    <Card variant="raised" padding="lg">
      <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">Payment methods</h2>
      <div className="flex w-full min-w-0 flex-col items-center" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={108}
              paddingAngle={donutData.length > 1 ? 2 : 0}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            >
              {donutData.map((entry, index) => (
                <Cell
                  key={entry.key}
                  fill={DONUT_COLORS[index % DONUT_COLORS.length] ?? 'var(--color-border)'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  Number(value ?? 0) / 100
                )
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-[var(--color-muted)]">
          {methodEntries.map(([m, cents], i) => {
            const pct = methodTotal > 0 ? Math.round((cents / methodTotal) * 100) : 0
            const mv = m as PaymentMethodValue
            return (
              <li key={m} className="flex items-center gap-1.5">
                <span
                  className={`inline-block size-2.5 rounded-full ${PAYMENT_METHOD_STYLES[mv]?.split(' ')[0] ?? 'bg-neutral-400'}`}
                  style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                {PAYMENT_METHOD_LABELS[mv] ?? m} {pct}%
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
