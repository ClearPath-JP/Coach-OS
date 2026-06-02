'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type InkedIconName } from '@/components/icons/inked'
import { CoachMoreSheet } from './CoachMoreSheet'

const NAV_ITEMS: { href: string; label: string; icon: InkedIconName }[] = [
  { href: '/coach/dashboard', label: 'Home', icon: 'dashboard' },
  { href: '/coach/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/coach/clients', label: 'Clients', icon: 'clients' },
  { href: '/coach/messages', label: 'Messages', icon: 'messages' },
]

type CoachNavProps = {
  brandName: string
  coachName: string | null
  coachAvatarUrl: string | null
}

/** Mobile-only bottom dock. Desktop navigation lives in CoachSidebarShell. */
export function CoachNav(_props: CoachNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <nav className="coach-nav__mobile" aria-label="Navigation">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`coach-nav__mobile-link ${isActive(href) ? 'coach-nav__mobile-link--active' : ''}`}
          >
            <Icon name={icon} size={20} />
            <span className="coach-nav__mobile-label">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="coach-nav__mobile-link"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
          </svg>
          <span className="coach-nav__mobile-label">More</span>
        </button>
      </nav>
      <CoachMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
