'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  )
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

const PRIMARY = [
  { href: '/coach/dashboard', label: 'Home', Icon: HomeIcon },
  { href: '/coach/clients', label: 'Clients', Icon: ClientsIcon },
  { href: '/coach/messages', label: 'Messages', Icon: MessagesIcon },
  { href: '/coach/schedule', label: 'Schedule', Icon: CalendarIcon },
] as const

const MORE_LINKS = [
  { href: '/coach/programs', label: 'Programs' },
  { href: '/coach/assignments', label: 'Assignments' },
  { href: '/coach/videos', label: 'Videos' },
  { href: '/coach/packages', label: 'Packages' },
  { href: '/coach/invoices', label: 'Invoices' },
  { href: '/coach/payments', label: 'Payments' },
  { href: '/coach/analytics', label: 'Analytics' },
  { href: '/coach/settings', label: 'Settings' },
  { href: '/billing', label: 'Billing' },
] as const

/**
 * Coach mobile bottom bar: five destinations (Home, Clients, Messages, Schedule, More).
 * "More" opens a sheet with the rest of the coach nav. Unread badge polls conversations lightly.
 */
export function CoachMobileDock() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [unreadTotal, setUnreadTotal] = useState(0)

  const refreshUnread = useCallback(() => {
    void fetch('/api/messages/conversations', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { data?: { unreadCount?: number }[] }) => {
        const rows = Array.isArray(j.data) ? j.data : []
        const n = rows.reduce((acc, c) => acc + (c.unreadCount && c.unreadCount > 0 ? c.unreadCount : 0), 0)
        setUnreadTotal(n)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshUnread()
    const id = window.setInterval(refreshUnread, 60_000)
    return () => window.clearInterval(id)
  }, [refreshUnread])

  const moreActive = MORE_LINKS.some((l) => {
    if (l.href === '/billing') return pathname.startsWith('/billing')
    return pathname === l.href || pathname.startsWith(`${l.href}/`)
  })

  return (
    <>
      {sheetOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSheetOpen(false)}
        />
      ) : null}
      <div
        className={cn(
          'safe-bottom fixed bottom-0 left-0 right-0 z-50 max-h-[min(72vh,520px)] overflow-y-auto rounded-t-[16px] border border-[var(--border-default)] bg-[var(--cp-offwhite)] shadow-[var(--shadow-xl)] transition-transform duration-200 ease-out lg:hidden',
          sheetOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full opacity-0'
        )}
        role="dialog"
        aria-label="More navigation"
        aria-hidden={!sheetOpen}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--cp-offwhite)] px-4 py-3">
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">More</p>
          <button
            type="button"
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-[14px] font-medium text-[var(--cp-accent)]"
            onClick={() => setSheetOpen(false)}
          >
            Done
          </button>
        </div>
        <nav className="px-2 py-2" aria-label="Additional pages">
          <ul className="space-y-0.5">
            {MORE_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex min-h-[44px] items-center rounded-[var(--radius-md)] px-3 text-[15px] font-medium transition-colors duration-[80ms]',
                      active
                        ? 'bg-[var(--accent-light)] text-[var(--cp-accent)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    )}
                    onClick={() => setSheetOpen(false)}
                  >
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <nav
        className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--cp-offwhite)]/92 backdrop-blur-[12px] lg:hidden"
        role="navigation"
        aria-label="Coach main"
      >
        <div className="flex min-h-[56px] items-stretch justify-between gap-0 px-1 py-1">
          {PRIMARY.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/coach/dashboard' && pathname.startsWith(href))
            const showUnread = href === '/coach/messages' && unreadTotal > 0
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1 text-[10px] font-medium transition-[color,transform] duration-150 [transition-timing-function:var(--ease-out)]',
                  'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
                  active ? 'text-[var(--cp-accent)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('size-[22px] shrink-0', active ? 'text-[var(--cp-accent)]' : 'text-[var(--text-tertiary)]')} />
                <span className="line-clamp-1 w-full text-center">{label}</span>
                {showUnread ? (
                  <span
                    className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--cp-accent)] px-1 text-[10px] font-semibold text-[var(--text-on-accent)]"
                    aria-label={`${unreadTotal} unread messages`}
                  >
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                ) : null}
              </Link>
            )
          })}
          <button
            type="button"
            className={cn(
              'relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1 text-[10px] font-medium transition-[color,transform] duration-150 [transition-timing-function:var(--ease-out)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
              moreActive || sheetOpen
                ? 'text-[var(--cp-accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
            )}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            onClick={() => setSheetOpen((o) => !o)}
          >
            <MoreIcon
              className={cn(
                'size-[22px] shrink-0',
                moreActive || sheetOpen ? 'text-[var(--cp-accent)]' : 'text-[var(--text-tertiary)]'
              )}
            />
            <span className="line-clamp-1 w-full text-center">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
