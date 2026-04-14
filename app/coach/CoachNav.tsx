'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CreditCard, Users, Video, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/coach/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/coach/clients', label: 'Clients', icon: Users },
  { href: '/coach/payments', label: 'Payments', icon: CreditCard },
  { href: '/coach/videos', label: 'Videos', icon: Video },
] as const

export function CoachNav({ brandName }: { brandName: string }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="coach-nav">
      {/* Brand */}
      <Link href="/coach/schedule" className="coach-nav__brand">
        {brandName}
      </Link>

      {/* Nav links — desktop */}
      <nav className="coach-nav__links" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`coach-nav__link ${isActive(href) ? 'coach-nav__link--active' : ''}`}
          >
            <Icon className="coach-nav__link-icon" strokeWidth={1.5} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Settings */}
      <Link
        href="/coach/settings"
        className={`coach-nav__settings ${isActive('/coach/settings') ? 'coach-nav__link--active' : ''}`}
        aria-label="Settings"
      >
        <Settings className="size-[18px]" strokeWidth={1.5} />
      </Link>

      {/* Mobile bottom nav */}
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
    </header>
  )
}
