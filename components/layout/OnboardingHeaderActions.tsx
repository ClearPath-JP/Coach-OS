'use client'

import { SignOutButton } from '@/components/layout/SignOutButton'
import { cn } from '@/lib/utils'

/** Log out while in onboarding (no sidebar / bottom nav). */
export function OnboardingHeaderActions({ className }: { className?: string }) {
  return <SignOutButton variant="nav" className={cn(className)} />
}
