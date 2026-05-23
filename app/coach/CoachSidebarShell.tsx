'use client'

import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Sparkles,
  Swords,
  Ticket,
  Users,
  Video,
  ClipboardCheck,
  Package,
  Settings,
} from 'lucide-react'
import { Sidebar, type SidebarNavSection } from '@/components/layout/Sidebar'

const SECTIONS: SidebarNavSection[] = [
  {
    title: 'Command Center',
    items: [
      { href: '/coach/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
      { href: '/coach/schedule', label: 'Schedule', icon: <CalendarDays size={16} strokeWidth={1.5} /> },
      { href: '/coach/classes', label: 'Classes', icon: <Ticket size={16} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'Clients',
    items: [
      { href: '/coach/clients', label: 'Clients', icon: <Users size={16} strokeWidth={1.5} /> },
      { href: '/coach/leads', label: 'Lead research', icon: <Sparkles size={16} strokeWidth={1.5} /> },
      { href: '/coach/assignments', label: 'Assignments', icon: <ClipboardCheck size={16} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'Business',
    items: [
      { href: '/coach/programs', label: 'Programs', icon: <Swords size={16} strokeWidth={1.5} /> },
      { href: '/coach/packages', label: 'Packages', icon: <Package size={16} strokeWidth={1.5} /> },
      { href: '/coach/payments', label: 'Payments', icon: <CreditCard size={16} strokeWidth={1.5} /> },
      { href: '/coach/videos', label: 'Videos', icon: <Video size={16} strokeWidth={1.5} /> },
    ],
  },
]

const BOTTOM_ITEMS = [
  { href: '/coach/settings', label: 'Settings', icon: <Settings size={16} strokeWidth={1.5} /> },
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
