'use client'

import { usePathname, useRouter } from 'next/navigation'
import { playBack, playHover } from '@/lib/game-sounds'

const TITLE_MAP: Record<string, string> = {
  '/coach/schedule': 'Schedule',
  '/coach/clients': 'Clients',
  '/coach/messages': 'Messages',
  '/coach/programs': 'Programs',
  '/coach/videos': 'Videos',
  '/coach/payments': 'Payments',
  '/coach/invoices': 'Invoices',
  '/coach/packages': 'Packages',
  '/coach/analytics': 'Analytics',
  '/coach/assignments': 'Assignments',
  '/coach/settings': 'Settings',
  '/coach/subscription': 'Subscription',
}

function resolveTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname]
  // Handle dynamic routes like /coach/clients/[id]
  const segments = pathname.split('/')
  const parent = segments.slice(0, 3).join('/')
  if (TITLE_MAP[parent]) return TITLE_MAP[parent]
  return 'Coach'
}

export function GameBar() {
  const pathname = usePathname()
  const router = useRouter()

  // Hide on dashboard — it IS the game menu
  if (pathname === '/coach/dashboard') return null

  const title = resolveTitle(pathname)

  return (
    <header className="game-bar">
      <button
        type="button"
        className="game-bar__home"
        onClick={() => { playBack(); router.push('/coach/dashboard') }}
        onMouseEnter={playHover}
        aria-label="Back to menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="game-bar__home-label">Menu</span>
      </button>

      <h1 className="game-bar__title">{title}</h1>

      <div className="game-bar__spacer" />
    </header>
  )
}
