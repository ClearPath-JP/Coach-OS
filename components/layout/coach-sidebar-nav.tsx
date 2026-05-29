import type { SidebarNavItem, SidebarNavSection } from '@/components/layout/Sidebar'
import {
  AnalyticsIcon,
  ClientsIcon,
  DashboardIcon,
  InvoicesIcon,
  MessagesIcon,
  PackagesIcon,
  PaymentsIcon,
  ProgramsIcon,
  PromoteIcon,
  ScheduleIcon,
  SubscriptionIcon,
  VideosIcon,
} from '@/components/layout/coach-nav-icons'

/** Desktop coach sidebar — Figma-style grouped nav. */
export function getCoachSidebarNav(): {
  topItems: SidebarNavItem[]
  sections: SidebarNavSection[]
} {
  return {
    topItems: [],
    sections: [
      {
        title: 'WORKSPACE',
        items: [
          { href: '/coach/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { href: '/coach/analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
        ],
      },
      {
        title: 'COACHING',
        items: [
          { href: '/coach/clients', label: 'Clients', icon: <ClientsIcon /> },
          { href: '/coach/messages', label: 'Messages', icon: <MessagesIcon /> },
          { href: '/coach/schedule', label: 'Schedule', icon: <ScheduleIcon /> },
        ],
      },
      {
        title: 'CONTENT',
        items: [
          { href: '/coach/programs', label: 'Programs', icon: <ProgramsIcon /> },
          { href: '/coach/promote', label: 'Promote', icon: <PromoteIcon /> },
          { href: '/coach/videos', label: 'Videos', icon: <VideosIcon /> },
        ],
      },
      {
        title: 'BUSINESS',
        items: [
          { href: '/coach/packages', label: 'Packages', icon: <PackagesIcon /> },
          { href: '/coach/invoices', label: 'Invoices', icon: <InvoicesIcon /> },
          { href: '/coach/payments', label: 'Payments', icon: <PaymentsIcon /> },
          { href: '/coach/subscription', label: 'Subscription', icon: <SubscriptionIcon /> },
        ],
      },
    ],
  }
}
