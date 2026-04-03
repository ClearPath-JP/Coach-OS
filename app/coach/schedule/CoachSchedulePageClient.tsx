'use client'

import dynamic from 'next/dynamic'

const CoachScheduleWorkspace = dynamic(
  () => import('./CoachScheduleWorkspace').then((m) => m.CoachScheduleWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[240px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" aria-hidden />
    ),
  }
)

export function CoachSchedulePageClient() {
  return (
    <main className="flex min-h-0 min-h-screen flex-1 flex-col">
      <CoachScheduleWorkspace />
    </main>
  )
}
