'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

function ProfileIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 14a4 4 0 0 0 4-4 2 2 0 0 0-4 0" />
      <path d="M8 20h8" />
    </svg>
  )
}

function BillingIcon({ className }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <path d="M6 15h.01M10 15h.01M14 15h.01M18 15h.01" />
    </svg>
  )
}

function PackagesIcon({ className }: { className?: string }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  )
}

function ProgramsIcon({ className }: { className?: string }) {
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
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  )
}

function VideosIcon({ className }: { className?: string }) {
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
      <path d="M22 8v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
      <path d="m10 8 6 4-6 4V8z" />
    </svg>
  )
}

function AnalyticsIcon({ className }: { className?: string }) {
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
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 5 4-9" />
    </svg>
  )
}

function PaymentsIcon({ className }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function AssignmentsIcon({ className }: { className?: string }) {
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
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

export const coachTabs = [
  { href: '/coach/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/coach/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { href: '/coach/clients', label: 'Clients', icon: ClientsIcon },
  { href: '/coach/schedule', label: 'Schedule', icon: CalendarIcon },
  { href: '/coach/programs', label: 'Programs', icon: ProgramsIcon },
  { href: '/coach/assignments', label: 'Assign', icon: AssignmentsIcon },
  { href: '/coach/videos', label: 'Videos', icon: VideosIcon },
  { href: '/coach/messages', label: 'Messages', icon: MessagesIcon },
  { href: '/coach/packages', label: 'Packages', icon: PackagesIcon },
  { href: '/coach/invoices', label: 'Invoices', icon: InvoicesIcon },
  { href: '/coach/payments', label: 'Payments', icon: PaymentsIcon },
  { href: '/billing', label: 'Billing', icon: BillingIcon },
] as const

function GoalsIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export const clientPortalTabs = [
  { href: '/client/portal', label: 'Home', icon: HomeIcon },
  { href: '/client/goals', label: 'Goals', icon: GoalsIcon },
  { href: '/client/messages', label: 'Messages', icon: MessagesIcon },
  { href: '/client/programs', label: 'Programs', icon: ProgramsIcon },
  { href: '/client/assignments', label: 'Tasks', icon: AssignmentsIcon },
  { href: '/client/sessions', label: 'Sessions', icon: CalendarIcon },
  { href: '/client/invoices', label: 'Invoices', icon: InvoicesIcon },
  { href: '/client/profile', label: 'Profile', icon: ProfileIcon },
] as const

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
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

export interface MobileNavTab {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface MobileNavProps {
  className?: string
  tabs?: readonly MobileNavTab[]
  messageUnreadCount?: number
  /** Client portal: gentle reminder when today's daily check-in is still open */
  checkInReminderDot?: boolean
}

/** Bottom tab bar — visible only below lg. Matches ClearPath design system (blur, accent active state). */
export function MobileNav({
  className,
  tabs = coachTabs,
  messageUnreadCount = 0,
  checkInReminderDot = false,
}: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'safe-bottom fixed bottom-0 left-0 right-0 z-40 lg:hidden',
        'border-t border-[var(--border-default)] bg-[var(--bg-app)]/92 backdrop-blur-[12px]',
        className
      )}
      role="navigation"
      aria-label="Main"
    >
      <div className="flex max-h-[72px] items-stretch justify-start gap-0.5 overflow-x-auto overscroll-x-contain px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== '/' && pathname.startsWith(href))
          const isMessagesTab = href.includes('messages')
          const showBadge = isMessagesTab && messageUnreadCount > 0
          const isClientHome = href === '/client/portal'
          const showCheckInDot = isClientHome && checkInReminderDot
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex min-h-[44px] min-w-[52px] max-w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1.5 py-1',
                'text-[10px] font-medium tracking-[var(--tracking-normal)] transition-[background-color,color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-out)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
                isActive
                  ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn('size-[22px] shrink-0', isActive && 'text-[var(--accent)]')} />
              <span className="line-clamp-1 w-full text-center">{label}</span>
              {showBadge ? (
                <span
                  className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--success)] px-1 text-[10px] font-semibold text-[var(--text-on-accent)]"
                  aria-label={`${messageUnreadCount} unread messages`}
                >
                  {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                </span>
              ) : null}
              {showCheckInDot ? (
                <span
                  className="pointer-events-none absolute right-0.5 top-0.5 size-2 rounded-full bg-amber-500 shadow-sm ring-2 ring-[var(--bg-app)]"
                  aria-label="Daily check-in available on Home"
                />
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
