'use client'

import { SignOutButton } from '@/components/layout/SignOutButton'

/** Log out while in onboarding (no sidebar / bottom nav). */
export function OnboardingHeaderActions() {
  return <SignOutButton variant="nav" />
}
