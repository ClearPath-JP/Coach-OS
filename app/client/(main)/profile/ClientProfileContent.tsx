'use client'

import { WeeklyUnavailabilityEditor } from '@/components/unavailability/WeeklyUnavailabilityEditor'

export function ClientProfileContent() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-medium text-[var(--color-ink)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Profile details and scheduling preferences.</p>
      </div>
      <WeeklyUnavailabilityEditor variant="client" />
    </div>
  )
}
