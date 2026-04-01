'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { clientPortalTabs } from '@/components/layout/MobileNav'
import { ClientPortalSidebarFooter } from '@/components/layout/ClientPortalSidebarFooter'

const settingsIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3.4a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5 8.89a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9.11 5c.7 0 1.33-.4 1.62-1.03V3.9a2 2 0 1 1 4 0v.07c.29.63.92 1.03 1.62 1.03a1.65 1.65 0 0 0 1.17-.48l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.6 1.16-.33 1.82.27.66.91 1.1 1.62 1.1h.09a2 2 0 1 1 0 4h-.09c-.71 0-1.35.44-1.62 1.1z" />
  </svg>
)

/** Desktop (lg+) left rail: same destinations as bottom tabs, Settings → profile, Log out in footer. */
export function ClientPortalDesktopSidebar({ className }: { className?: string }) {
  const primary = clientPortalTabs.slice(0, -1)
  const items = primary.map(({ href, label, icon: Icon }) => ({
    href,
    label,
    icon: <Icon className="size-[18px] shrink-0" aria-hidden />,
  }))
  const bottomItems = [
    {
      href: '/client/profile',
      label: 'Settings',
      icon: settingsIcon,
    },
  ]
  return (
    <Sidebar
      items={items}
      bottomItems={bottomItems}
      footer={<ClientPortalSidebarFooter />}
      {...(className ? { className } : {})}
    />
  )
}
