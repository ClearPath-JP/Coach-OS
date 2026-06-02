'use client'

import { Icon } from '@/components/icons/inked'
import { Sidebar, type SidebarNavItem, type SidebarNavSection } from '@/components/layout/Sidebar'

const TOP_ITEMS: SidebarNavItem[] = [
  { href: '/coach/dashboard', label: 'Dashboard', icon: <Icon name="dashboard" /> },
]

const SECTIONS: SidebarNavSection[] = [
  {
    title: 'Coaching',
    items: [
      { href: '/coach/schedule', label: 'Schedule', icon: <Icon name="schedule" /> },
      { href: '/coach/classes', label: 'Classes', icon: <Icon name="classes" /> },
      { href: '/coach/clients', label: 'Clients', icon: <Icon name="clients" /> },
      { href: '/coach/messages', label: 'Messages', icon: <Icon name="messages" /> },
    ],
  },
  {
    title: 'Offerings',
    items: [
      { href: '/coach/programs', label: 'Programs', icon: <Icon name="programs" /> },
      { href: '/coach/packages', label: 'Packages', icon: <Icon name="packages" /> },
      { href: '/coach/memberships', label: 'Memberships', icon: <Icon name="memberships" /> },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/coach/payments', label: 'Payments', icon: <Icon name="payments" /> },
      { href: '/coach/invoices', label: 'Invoices', icon: <Icon name="invoices" /> },
      { href: '/coach/analytics', label: 'Analytics', icon: <Icon name="analytics" /> },
    ],
  },
  {
    title: 'Grow',
    items: [
      { href: '/coach/promote', label: 'Promote', icon: <Icon name="promote" /> },
      { href: '/coach/leads', label: 'Lead Research', icon: <Icon name="leads" />, pill: 'PRO' },
      { href: '/coach/videos', label: 'Videos', icon: <Icon name="videos" /> },
    ],
  },
]

const BOTTOM_ITEMS: SidebarNavItem[] = [
  { href: '/coach/subscription', label: 'Subscription', icon: <Icon name="subscription" /> },
  { href: '/coach/settings', label: 'Settings', icon: <Icon name="settings" /> },
]

type CoachSidebarShellProps = {
  coachName: string | null
  coachAvatarUrl: string | null
}

export function CoachSidebarShell({ coachName, coachAvatarUrl }: CoachSidebarShellProps) {
  return (
    <div className="hidden lg:flex">
      <Sidebar
        variant="coach"
        wordmark
        topItems={TOP_ITEMS}
        sections={SECTIONS}
        bottomItems={BOTTOM_ITEMS}
        userBar={{
          displayName: coachName ?? 'Coach',
          avatarUrl: coachAvatarUrl,
          settingsHref: '/coach/settings',
        }}
        className="!h-dvh"
      />
    </div>
  )
}
