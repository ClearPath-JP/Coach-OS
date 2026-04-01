import type { SidebarNavItem, SidebarNavSection } from '@/components/layout/Sidebar'
import {
  AnalyticsIcon,
  AssignmentsIcon,
  BillingNavIcon,
  ClientsIcon,
  InvoicesIcon,
  DashboardIcon,
  MessagesIcon,
  PackagesIcon,
  PaymentsIcon,
  ProgramsIcon,
  ScheduleIcon,
  VideosIcon,
} from '@/components/layout/coach-nav-icons'

/** Desktop coach sidebar — Linear-style grouped nav. */
export function getCoachSidebarNav(): {
  topItems: SidebarNavItem[]
  sections: SidebarNavSection[]
} {
  return {
    topItems: [],
    sections: [
      {
        title: 'OVERVIEW',
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
          { href: '/coach/schedule', label: 'Calendar', icon: <ScheduleIcon /> },
        ],
      },
      {
        title: 'CONTENT',
        items: [
          { href: '/coach/programs', label: 'Programs', icon: <ProgramsIcon /> },
          { href: '/coach/assignments', label: 'Assignments', icon: <AssignmentsIcon /> },
          { href: '/coach/videos', label: 'Videos', icon: <VideosIcon /> },
        ],
      },
      {
        title: 'BUSINESS',
        items: [
          { href: '/coach/packages', label: 'Packages', icon: <PackagesIcon /> },
          { href: '/coach/invoices', label: 'Invoices', icon: <InvoicesIcon /> },
          { href: '/coach/payments', label: 'Payments', icon: <PaymentsIcon /> },
          { href: '/billing', label: 'Billing', icon: <BillingNavIcon /> },
        ],
      },
    ],
  }
}
