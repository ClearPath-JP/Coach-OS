'use client'

import Image from 'next/image'
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

export function CoachNav({ brandName, coachName, coachAvatarUrl }: CoachNavProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const initials = coachName
    ? coachName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  return (
    <>
      {/* Desktop top bar */}
      <header className="coach-nav">
        {/* Avatar + Brand */}
        <Link href="/coach/settings" className="coach-nav__profile" aria-label="Settings">
          {coachAvatarUrl ? (
            <Image
              src={coachAvatarUrl}
              alt=""
              width={28}
              height={28}
              className="coach-nav__avatar"
            />
          ) : (
            <span className="coach-nav__avatar-fallback">{initials}</span>
          )}
          <span className="coach-nav__brand">{brandName}</span>
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
      </header>

      {/* Mobile bottom dock */}
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
    </>
  )
}
