'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CreditCard, Swords, Users, Video, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/coach/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/coach/clients', label: 'Clients', icon: Users },
  { href: '/coach/payments', label: 'Payments', icon: CreditCard },
  { href: '/coach/videos', label: 'Videos', icon: Video },
  { href: '/coach/programs', label: 'Programs', icon: Swords },
] as const

type CoachNavProps = {
  brandName: string
  coachName: string | null
  coachAvatarUrl: string | null
}

/** Mobile-only bottom dock. Desktop navigation lives in CoachSidebarShell. */
export function CoachNav({ brandName }: CoachNavProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="coach-nav__mobile" aria-label="Navigation">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`coach-nav__mobile-link ${isActive(href) ? 'coach-nav__mobile-link--active' : ''}`}
        >
          <Icon className="size-5" strokeWidth={1.5} />
          <span className="coach-nav__mobile-label">{label}</span>
        </Link>
      ))}
      <Link
        href="/coach/settings"
        className={`coach-nav__mobile-link ${isActive('/coach/settings') ? 'coach-nav__mobile-link--active' : ''}`}
      >
        <Settings className="size-5" strokeWidth={1.5} />
        <span className="coach-nav__mobile-label">Settings</span>
      </Link>
    </nav>
  )
}
