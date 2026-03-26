'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export interface NavProps {
  className?: string
  userDisplayName?: string | null
  logoHref?: string
  brandName?: string | null | undefined
  showThemeToggle?: boolean
  showSignOut?: boolean
  coachApp?: boolean
  coachAvatarUrl?: string | null
  notificationCount?: number
  clientPortal?: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    const first = parts[0]
    const last = parts[parts.length - 1]
    const a = first?.[0] ?? ''
    const b = last?.[0] ?? ''
    return (a + b).toUpperCase().slice(0, 2) || '?'
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function coachTitleFromPath(pathname: string): string {
  if (pathname === '/coach/dashboard' || pathname === '/billing') {
    return pathname === '/billing' ? 'Billing' : 'Dashboard'
  }
  if (pathname.startsWith('/coach/clients/')) return 'Client'
  if (pathname.startsWith('/coach/clients')) return 'Clients'
  if (pathname.startsWith('/coach/schedule')) return 'Schedule'
  if (pathname.startsWith('/coach/programs/')) return 'Program'
  if (pathname.startsWith('/coach/programs')) return 'Programs'
  if (pathname.startsWith('/coach/videos')) return 'Videos'
  if (pathname.startsWith('/coach/messages')) return 'Messages'
  if (pathname.startsWith('/coach/packages')) return 'Packages'
  if (pathname.startsWith('/coach/invoices')) return 'Invoices'
  if (pathname.startsWith('/coach/payments')) return 'Payments'
  if (pathname.startsWith('/coach/analytics')) return 'Analytics'
  if (pathname.startsWith('/coach/settings')) return 'Settings'
  if (pathname.startsWith('/coach')) return 'Coach'
  return 'ClearPath'
}

function NavThemeIconButton() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-primary)] transition-[background-color,box-shadow] duration-[var(--duration-normal)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

function CoachUserMenu({
  displayName,
  avatarUrl,
}: {
  displayName: string
  avatarUrl?: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-[box-shadow] duration-[var(--duration-normal)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initials(displayName)
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)] py-1 shadow-[var(--shadow-lg)]"
        >
          <Link
            role="menuitem"
            href="/coach/settings"
            className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            onClick={() => setOpen(false)}
          >
            Profile settings
          </Link>
          <Link
            role="menuitem"
            href="/billing"
            className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            onClick={() => setOpen(false)}
          >
            Billing
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            className="w-full px-4 py-2.5 text-left text-sm text-[var(--error)] hover:bg-[var(--error-bg)] disabled:opacity-40"
            onClick={() => void onSignOut()}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function Nav({
  className,
  userDisplayName,
  logoHref = '/',
  brandName,
  showThemeToggle,
  showSignOut,
  coachApp,
  coachAvatarUrl,
  notificationCount = 0,
  clientPortal,
}: NavProps) {
  const pathname = usePathname() ?? ''
  const logoLabel = brandName?.trim() || 'ClearPath'
  const coachTitle = coachApp ? coachTitleFromPath(pathname) : null
  const { theme } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const headerBg =
    scrolled && theme === 'light'
      ? 'rgba(255,255,255,0.85)'
      : scrolled && theme === 'dark'
        ? 'rgba(25,25,25,0.85)'
        : undefined

  return (
    <header className={cn('z-30', className)} role="banner">
      <nav
        className={cn(
          'sticky top-0 z-30 flex h-[var(--nav-height)] items-center justify-between border-b border-[var(--border-subtle)] px-6 backdrop-blur-[12px] transition-[background-color] duration-[var(--duration-normal)]'
        )}
        style={{
          backgroundColor: headerBg ?? 'var(--bg-app)',
        }}
      >
        {coachApp ? (
          <h1 className="truncate text-[14px] font-medium text-[var(--text-primary)]">{coachTitle}</h1>
        ) : clientPortal ? (
          <Link
            href={logoHref}
            className="truncate text-[17px] font-semibold tracking-[var(--tracking-heading)] text-[var(--text-primary)] transition-colors duration-150 hover:text-[var(--accent)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {logoLabel}
          </Link>
        ) : (
          <Link
            href={logoHref}
            className="rounded-[var(--radius-md)] font-medium text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {logoLabel}
          </Link>
        )}

        <div className="flex min-w-0 flex-1 justify-center" aria-hidden={!coachApp} />

        <div className={cn('flex items-center', coachApp ? 'gap-1' : 'gap-2')}>
          {clientPortal && !coachApp ? (
            <>
              {showThemeToggle ? <NavThemeIconButton /> : null}
              {userDisplayName ? (
                <div className="flex items-center gap-2">
                  <span className="hidden max-w-[200px] truncate text-sm text-[var(--text-primary)] sm:inline">
                    {userDisplayName}
                  </span>
                  <div
                    className="avatar-hover flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)]"
                    aria-hidden
                  >
                    {initials(userDisplayName)}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {coachApp ? (
            <>
              <button
                type="button"
                className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                aria-label="Notifications"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notificationCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--text-on-accent)]">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                ) : (
                  <span
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-[var(--error)]"
                    aria-hidden
                  />
                )}
              </button>
              {showThemeToggle ? <NavThemeIconButton /> : null}
              {userDisplayName ? (
                <CoachUserMenu displayName={userDisplayName} avatarUrl={coachAvatarUrl ?? null} />
              ) : (
                <CoachUserMenu displayName="Coach" avatarUrl={null} />
              )}
            </>
          ) : clientPortal ? null : (
            <>
              {showSignOut ? (
                <div className="lg:hidden">
                  <SignOutButton variant="nav" />
                </div>
              ) : null}
              {showThemeToggle ? <NavThemeIconButton /> : null}
              {userDisplayName ? (
                <span className="flex items-center gap-2 text-[15px] text-[var(--text-primary)]">
                  <span className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-primary)] lg:size-9 lg:min-h-9 lg:min-w-9">
                    {initials(userDisplayName)}
                  </span>
                  <span className="hidden min-w-0 max-w-[180px] truncate sm:inline">{userDisplayName}</span>
                </span>
              ) : !showSignOut ? (
                <>
                  <button
                    type="button"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    aria-label="Notifications"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    aria-label="User menu"
                  >
                    <span className="text-sm font-medium" aria-hidden>
                      U
                    </span>
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
