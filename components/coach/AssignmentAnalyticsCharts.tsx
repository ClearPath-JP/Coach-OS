'use client'

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/components/ui/Card'

export type AssignmentAnalyticsChartsProps = {
  completionRatePct: number
  topClientsByXp: { name: string; totalXp: number; level: number; clientId: string }[]
}

export function AssignmentAnalyticsCharts({ completionRatePct, topClientsByXp }: AssignmentAnalyticsChartsProps) {
  const pieData = [
    { name: 'Done', value: completionRatePct },
    { name: 'Rest', value: Math.max(0, 100 - completionRatePct) },
  ]
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-medium">Completion rate</h3>
        {/* min-height + positive initialDimension: avoids Recharts "width(-1)/height(-1)"
            warnings when charts mount before the ResizeObserver reports a size. */}
        <div className="h-48 min-h-48 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 192 }}>
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={2}>
                <Cell fill="var(--cp-accent)" />
                <Cell fill="var(--border-default)" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-sm text-[var(--text-secondary)]">{completionRatePct}% completed</p>
      </Card>
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-medium">Top clients by XP</h3>
        <div className="h-48 min-h-48 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 192 }}>
            <BarChart data={topClientsByXp.slice(0, 5)}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="totalXp" fill="var(--cp-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
