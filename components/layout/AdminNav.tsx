'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

type NavItem = { href: string; label: string; match?: 'exact' | 'prefix' }

type NavSection = { title: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ href: '/admin/overview', label: 'Dashboard', match: 'exact' }],
  },
  {
    title: 'Coaches',
    items: [
      { href: '/admin/coaches', label: 'All coaches', match: 'prefix' },
      { href: '/admin/subscriptions', label: 'Subscriptions', match: 'exact' },
    ],
  },
  {
    title: 'Users',
    items: [{ href: '/admin/clients', label: 'All clients', match: 'exact' }],
  },
  {
    title: 'Business',
    items: [
      { href: '/admin/revenue', label: 'Revenue', match: 'exact' },
      { href: '/admin/audit', label: 'Audit log', match: 'exact' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/system', label: 'Health', match: 'exact' },
      { href: '/admin/errors', label: 'Coach/client errors', match: 'exact' },
      { href: '/admin/settings', label: 'Settings', match: 'exact' },
    ],
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === 'prefix') {
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  return pathname === item.href
}

export function AdminNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-0">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {section.title}
          </p>
          <ul className="space-y-px">
            {section.items.map((item) => {
              const active = isActive(pathname, item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      'mx-2 flex h-8 items-center rounded-md px-3 text-[13px] text-[#94A3B8] transition-colors',
                      active
                        ? 'bg-[#1E3A5F] text-[#60A5FA]'
                        : 'hover:bg-[#1E293B] hover:text-[#E2E8F0]'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
