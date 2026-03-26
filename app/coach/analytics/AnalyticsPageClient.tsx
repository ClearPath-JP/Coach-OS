'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const AnalyticsPageContent = dynamic(
  () => import('./AnalyticsPageContent').then((m) => m.AnalyticsPageContent),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[320px] animate-pulse rounded-xl bg-[var(--color-surface)]" aria-hidden />
    ),
  }
)

function analyticsChartsFallback(): ReactNode {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-8 text-center">
      <p className="font-medium text-[var(--color-text-primary)]">Charts could not be displayed</p>
      <p className="mt-1 text-[13px] text-[var(--color-muted)]">Try refreshing the page or use Try again below.</p>
    </div>
  )
}

export function AnalyticsPageClient() {
  const wrapCharts = (node: ReactNode) => (
    <ErrorBoundary fallback={analyticsChartsFallback()}>{node}</ErrorBoundary>
  )

  return <AnalyticsPageContent wrapCharts={wrapCharts} />
}
