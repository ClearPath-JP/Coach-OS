'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { Tooltip } from '@/components/ui/Tooltip'
import { ClearPathLogo } from '@/components/layout/ClearPathLogo'
import { CoachNavTrail } from '@/components/layout/CoachNavTrail'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { openCommandPalette } from '@/lib/command-palette'

export interface NavProps {
  className?: string
  userDisplayName?: string | null
  logoHref?: string
  brandName?: string | null | undefined
  /** Coach workspace logo for client portal top nav */
  clientPortalLogoUrl?: string | null
  showThemeToggle?: boolean
  showSignOut?: boolean
  coachApp?: boolean
  coachAvatarUrl?: string | null
  notificationCount?: number
  clientPortal?: boolean
  /** Optional coach tagline under the brand name (desktop client portal) */
  clientPortalBrandTagline?: string | null
  /** Extra controls in the client portal header (e.g. notifications bell) */
  clientPortalTrailing?: ReactNode
}

const CLIENT_PORTAL_TOP_LINKS: { href: string; label: string }[] = [
  { href: '/client/portal', label: 'Home' },
  { href: '/client/programs', label: 'Programs' },
  { href: '/client/assignments', label: 'Tasks' },
  { href: '/client/goals', label: 'Goals' },
  { href: '/client/sessions', label: 'Sessions' },
  { href: '/client/messages', label: 'Messages' },
  { href: '/client/invoices', label: 'Invoices' },
]

function clientPortalTopLinkActive(pathname: string, href: string): boolean {
  if (href === '/client/portal') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ClientPortalQuickLinks({ pathname }: { pathname: string }) {
  return (
    <nav
      className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-0.5 gap-y-1 lg:flex"
      aria-label="Quick links"
    >
      {CLIENT_PORTAL_TOP_LINKS.map(({ href, label }) => {
        const active = clientPortalTopLinkActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-[background-color,color,transform] duration-150',
              active
                ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] active:scale-[0.98]'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
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

function CoachNavLeadingMark() {
  const { settings } = useWorkspace()
  const url = settings.logoUrl?.trim() ?? ''
  const [failedForUrl, setFailedForUrl] = useState<string | null>(null)
  const showCustomLogo = Boolean(url && failedForUrl !== url)

  const inner =
    showCustomLogo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-7 w-7 object-contain p-0.5"
        onError={() => setFailedForUrl(url)}
      />
    ) : (
      <ClearPathLogo size={28} />
    )

  return (
    <Link
      href="/coach/dashboard"
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] transition-colors hover:border-[var(--border-default)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      aria-label="Dashboard"
    >
      {inner}
    </Link>
  )
}

function NavThemeIconButton() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--text-primary)] transition-[background-color,box-shadow] duration-[80ms] hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
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

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="avatar-hover flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-[box-shadow] duration-150 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
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
  clientPortalLogoUrl,
  showThemeToggle,
  showSignOut,
  coachApp,
  coachAvatarUrl,
  notificationCount = 0,
  clientPortal,
  clientPortalBrandTagline,
  clientPortalTrailing,
}: NavProps) {
  const pathname = usePathname() ?? ''
  const logoLabel = brandName?.trim() || 'ClearPath'
  const { theme } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const clientPortalLogoTrimmed = clientPortalLogoUrl?.trim() ?? ''
  const [portalLogoFailedForUrl, setPortalLogoFailedForUrl] = useState<string | null>(null)
  const showClientPortalLogo = Boolean(clientPortalLogoTrimmed && portalLogoFailedForUrl !== clientPortalLogoTrimmed)

  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(notificationCount)
  const [notifications, setNotifications] = useState([
    { id: '1', type: 'message', title: 'New message from Sarah Johnson', body: 'Asked for a schedule change this week.', time: '2m ago', unread: true },
    { id: '2', type: 'session', title: 'Session starts in 30 minutes', body: 'Alex Carter · Performance review.', time: '25m ago', unread: true },
    { id: '3', type: 'payment', title: 'Invoice paid', body: 'Jordan Reed paid $220 via Stripe.', time: '1h ago', unread: false },
  ])

  useEffect(() => {
    if (clientPortal) return
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [clientPortal])

  useEffect(() => {
    if (!coachApp) return
    const load = () => {
      void fetch('/api/messages/unread-count', { credentials: 'include' })
        .then((r) => r.json())
        .then((json) => {
          if (typeof json?.data?.count === 'number') setUnreadCount(json.data.count)
        })
        .catch(() => {})
    }
    load()
    const t = window.setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [coachApp])

  const headerBg = clientPortal
    ? undefined
    : coachApp
      ? undefined
      : scrolled && theme === 'light'
        ? 'rgba(255,255,255,0.85)'
        : scrolled && theme === 'dark'
          ? 'rgba(25,25,25,0.85)'
          : undefined

  const clientNavSurface = 'rgba(var(--bg-app-rgb), 0.9)'
  const coachNavSurface = 'rgba(var(--bg-app-rgb), 0.9)'

  return (
    <header className={cn('z-30', className)} role="banner">
      <nav
        className={cn(
          'sticky top-0 z-30 flex h-[var(--nav-height)] items-center border-b border-[var(--border-subtle)] transition-[background-color,box-shadow] duration-[var(--duration-normal)]',
          clientPortal
            ? 'justify-center px-0 sm:px-0 lg:h-auto lg:min-h-[68px] lg:shadow-[var(--shadow-sm)]'
            : coachApp
              ? 'justify-between gap-4 px-6 backdrop-blur-[8px]'
              : 'justify-between px-4 sm:px-6'
        )}
        style={{
          backgroundColor: clientPortal
            ? clientNavSurface
            : coachApp
              ? coachNavSurface
              : headerBg ?? 'var(--bg-app)',
        }}
      >
        {coachApp ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-none">
            <span className="shrink-0 lg:hidden">
              <CoachNavLeadingMark />
            </span>
            <CoachNavTrail key={pathname} />
          </div>
        ) : clientPortal ? (
          <div className="mx-auto flex h-full min-h-[var(--nav-height)] w-full max-w-[1600px] items-center justify-between gap-2 px-4 sm:px-6 lg:min-h-0 lg:gap-4 lg:px-8">
            <Link
              href={logoHref}
              className="flex min-w-0 max-w-[min(100%,240px)] shrink-0 items-center gap-2 sm:max-w-[min(100%,280px)] sm:gap-2.5 lg:max-w-[min(100%,320px)] lg:gap-3 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {showClientPortalLogo ? (
                <span className="relative size-8 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)] lg:size-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={clientPortalLogoTrimmed}
                    src={clientPortalLogoTrimmed}
                    alt=""
                    className="size-full object-contain p-0.5"
                    onError={() => setPortalLogoFailedForUrl(clientPortalLogoTrimmed)}
                  />
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col justify-center gap-0.5">
                <span className="truncate text-[15px] font-semibold tracking-[var(--tracking-heading)] text-[var(--text-primary)] transition-colors duration-150 hover:text-[var(--accent)] lg:text-[17px]">
                  {logoLabel}
                </span>
                {clientPortalBrandTagline?.trim() ? (
                  <span className="hidden max-w-[240px] truncate text-[11px] leading-tight text-[var(--text-tertiary)] lg:block">
                    {clientPortalBrandTagline.trim()}
                  </span>
                ) : null}
              </span>
            </Link>
            <ClientPortalQuickLinks pathname={pathname} />
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5 lg:border-l lg:border-[var(--border-subtle)] lg:pl-4">
              {clientPortalTrailing}
              {userDisplayName ? (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="hidden max-w-[180px] truncate text-[13px] font-medium text-[var(--text-primary)] xl:inline">
                    {userDisplayName}
                  </span>
                  <div
                    className="avatar-hover flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)] lg:size-9"
                    aria-hidden
                  >
                    {initials(userDisplayName)}
                  </div>
                </div>
              ) : null}
              <SignOutButton variant="nav" className="text-[12px] sm:text-[13px]" />
            </div>
          </div>
        ) : (
          <Link
            href={logoHref}
            className="rounded-[var(--radius-md)] font-medium text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {logoLabel}
          </Link>
        )}

        {!clientPortal ? (
          <>
            <div
              className={cn('hidden min-w-0 flex-1 justify-center lg:block', coachApp && 'lg:block')}
              aria-hidden={!coachApp}
            />

            <div className={cn('flex items-center', coachApp ? 'gap-1' : 'gap-2')}>
          {coachApp ? (
            <>
              <Tooltip content="Search">
                <button
                  type="button"
                  onClick={() => openCommandPalette()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--text-tertiary)] transition-[background-color,color] duration-[80ms] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  aria-label="Open command palette"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip content="Notifications">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[var(--text-tertiary)] transition-[background-color,color] duration-[80ms] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
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
                  {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--error)] text-[10px] font-semibold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
                </button>
              </Tooltip>
              {notifOpen ? (
                <div className="absolute right-2 top-11 z-[110] w-[320px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] shadow-[var(--shadow-xl)]">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                    <p className="text-[14px] font-semibold text-[var(--text-primary)]">Notifications</p>
                    <button type="button" className="text-[12px] text-[var(--accent)]" onClick={() => { setNotifications((prev) => prev.map((n) => ({ ...n, unread: false }))); setUnreadCount(0) }}>Mark all read</button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--bg-muted)] text-2xl">🔔</div>
                        <p className="mt-3 text-[14px] font-medium text-[var(--text-primary)]">You&apos;re all caught up!</p>
                        <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">No new notifications</p>
                      </div>
                    ) : notifications.map((n) => (
                      <button key={n.id} type="button" className={`group relative flex w-full gap-2 border-b border-[var(--border-subtle)] px-4 py-3 text-left hover:bg-[var(--bg-subtle)] ${n.unread ? 'bg-[var(--accent-light)]' : ''}`}>
                        {n.unread ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)]" aria-hidden /> : null}
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[14px]">{n.type === 'message' ? '💬' : n.type === 'session' ? '📅' : n.type === 'payment' ? '💰' : '📚'}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-[var(--text-primary)]">{n.title}</span>
                          <span className="mt-0.5 block text-[12px] leading-[1.4] text-[var(--text-tertiary)]">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-[var(--text-quaternary)]">{n.time}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="w-full border-t border-[var(--border-subtle)] px-3 py-3 text-[13px] text-[var(--accent)]">View all notifications</button>
                </div>
              ) : null}
              {showThemeToggle ? <Tooltip content="Toggle theme"><span><NavThemeIconButton /></span></Tooltip> : null}
              <div className="shrink-0 lg:hidden">
                <SignOutButton variant="nav" />
              </div>
              {userDisplayName ? (
                <CoachUserMenu displayName={userDisplayName} avatarUrl={coachAvatarUrl ?? null} />
              ) : (
                <CoachUserMenu displayName="Coach" avatarUrl={null} />
              )}
            </>
          ) : (
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
          </>
        ) : null}
      </nav>
    </header>
  )
}
