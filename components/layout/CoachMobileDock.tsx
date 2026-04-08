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

function ProgramsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  )
}

function AssignmentsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

function VideosIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="m10 9 5 3-5 3V9z" />
    </svg>
  )
}

function PackagesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v6" />
      <path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
      <path d="M21 9l-9-6-9 6" />
      <path d="M3 9l9 6 9-6" />
    </svg>
  )
}

function InvoicesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}

function PaymentsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 5 4-9" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6c.7 0 1.33-.4 1.62-1.03V3a2 2 0 0 1 4 0v.09c.29.63.92 1.03 1.62 1.03a1.65 1.65 0 0 0 1.17-.48l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19 8.6c.66.27 1.1.91 1.1 1.62h.09a2 2 0 0 1 0 4h-.09c-.71 0-1.35.44-1.62 1.1z" />
    </svg>
  )
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v2M12 16v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 3.5-7 3.5-7 7a3.5 3.5 0 0 0 7 0" />
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
  { href: '/coach/subscription', label: 'Subscription' },
  { href: '/coach/analytics', label: 'Analytics' },
  { href: '/coach/settings', label: 'Settings' },
] as const

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

const MORE_GRID = [
  { href: '/coach/programs', label: 'Programs', Icon: ProgramsIcon },
  { href: '/coach/assignments', label: 'Assign', Icon: AssignmentsIcon },
  { href: '/coach/videos', label: 'Videos', Icon: VideosIcon },
  { href: '/coach/packages', label: 'Packages', Icon: PackagesIcon },
  { href: '/coach/invoices', label: 'Invoices', Icon: InvoicesIcon },
  { href: '/coach/payments', label: 'Payments', Icon: PaymentsIcon },
  { href: '/coach/subscription', label: 'Subscription', Icon: SparklesIcon },
  { href: '/coach/analytics', label: 'Analytics', Icon: AnalyticsIcon },
  { href: '/coach/settings', label: 'Settings', Icon: SettingsIcon },
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

  const moreActive = MORE_LINKS.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))

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
          'safe-bottom fixed bottom-0 left-0 right-0 z-50 max-h-[min(80vh,600px)] overflow-y-auto rounded-t-[16px] border border-[var(--border-default)] bg-[var(--cp-offwhite)] shadow-[var(--shadow-xl)] transition-transform duration-200 ease-out lg:hidden',
          sheetOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full opacity-0'
        )}
        role="dialog"
        aria-label="More navigation"
        aria-hidden={!sheetOpen}
      >
        <div className="flex justify-center pt-2.5 pb-0">
          <div className="h-1 w-10 rounded-full bg-[var(--border-default)]" aria-hidden />
        </div>
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
        <nav className="px-3 py-3" aria-label="Additional pages">
          <div className="grid grid-cols-3 gap-2">
            {MORE_GRID.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-[12px] border border-[var(--border-default)] px-2 py-3.5 transition-all duration-100 active:scale-[0.97]',
                    active ? 'border-[var(--accent-muted)] bg-[var(--accent-light)]' : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)]'
                  )}
                  onClick={() => setSheetOpen(false)}
                >
                  <span className={cn('flex size-10 items-center justify-center rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--bg-muted)]')}>
                    <Icon className={cn('shrink-0', active ? 'text-white' : 'text-[var(--text-secondary)]')} />
                  </span>
                  <span className={cn('text-[12px] font-medium text-center leading-tight', active ? 'text-[var(--cp-accent)]' : 'text-[var(--text-primary)]')}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
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
