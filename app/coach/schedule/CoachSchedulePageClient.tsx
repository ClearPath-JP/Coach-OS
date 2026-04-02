'use client'

import dynamic from 'next/dynamic'

const CoachScheduleWorkspace = dynamic(
  () => import('./CoachScheduleWorkspace').then((m) => m.CoachScheduleWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[240px] animate-pulse rounded-xl bg-[var(--color-surface)]" aria-hidden />
    ),
  }
)

export function CoachSchedulePageClient() {
  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8">
      <CoachScheduleWorkspace />
    </main>
  )
}
