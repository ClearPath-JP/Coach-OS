'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, BookOpen, MessageSquare, Megaphone, User, Ticket, Video, CalendarPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

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

export const coachTabs = [
  { href: '/coach/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/coach/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { href: '/coach/clients', label: 'Clients', icon: ClientsIcon },
  { href: '/coach/schedule', label: 'Schedule', icon: CalendarIcon },
  { href: '/coach/programs', label: 'Programs', icon: ProgramsIcon },
  { href: '/coach/promote', label: 'Promote', icon: Megaphone },
  { href: '/coach/videos', label: 'Videos', icon: VideosIcon },
  { href: '/coach/messages', label: 'Messages', icon: MessagesIcon },
  { href: '/coach/packages', label: 'Packages', icon: PackagesIcon },
  { href: '/coach/invoices', label: 'Invoices', icon: InvoicesIcon },
  { href: '/coach/payments', label: 'Payments', icon: PaymentsIcon },
  { href: '/coach/subscription', label: 'Subscription', icon: BillingIcon },
] as const

/** Mobile bottom bar — primary client destinations. Booking ("Book") gets a permanent home
 *  here since it's the core transaction; Membership/Goals/Sessions/Invoices live on Home + the desktop sidebar. */
export const clientPortalTabs: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/client/portal', label: 'Home', icon: LayoutDashboard },
  { href: '/client/classes', label: 'Book', icon: CalendarPlus },
  { href: '/client/programs', label: 'Programs', icon: BookOpen },
  { href: '/client/passes', label: 'Passes', icon: Ticket },
  { href: '/client/videos', label: 'Videos', icon: Video },
  { href: '/client/messages', label: 'Messages', icon: MessageSquare },
  { href: '/client/profile', label: 'Profile', icon: User },
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
  icon: React.ComponentType<{ className?: string }> | LucideIcon
}

export interface MobileNavProps {
  className?: string
  tabs?: readonly MobileNavTab[]
  messageUnreadCount?: number
  /** Client portal: pending + returned assignments */
  pendingAssignmentsCount?: number
}

/** Bottom tab bar — visible only below lg. Matches ClearPath design system (blur, accent active state). */
export function MobileNav({
  className,
  tabs = coachTabs,
  messageUnreadCount = 0,
  pendingAssignmentsCount = 0,
}: MobileNavProps) {
  const pathname = usePathname()
  const isClientPortalTabs = tabs === clientPortalTabs || tabs.length <= 5

  return (
    <nav
      className={cn(
        'safe-bottom fixed bottom-0 left-0 right-0 z-40 lg:hidden',
        'border-t border-[var(--border-subtle)] bg-[var(--cp-offwhite)]/95 backdrop-blur-[12px]',
        className
      )}
      role="navigation"
      aria-label="Main"
    >
      <div
        className={cn(
          'flex items-stretch justify-between gap-0 px-1 py-1',
          isClientPortalTabs ? 'min-h-[58px]' : 'max-h-[72px] justify-start gap-0.5 overflow-x-auto overscroll-x-contain py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== '/' && pathname.startsWith(href))
          const isMessagesTab = href.includes('messages')
          const isTasksTab = href.includes('assignments')
          const showMsgBadge = isMessagesTab && messageUnreadCount > 0
          const showTasksBadge = isTasksTab && pendingAssignmentsCount > 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1',
                'text-[10px] font-medium tracking-[var(--tracking-normal)] transition-[color,transform] duration-150 [transition-timing-function:var(--ease-out)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
                isClientPortalTabs
                  ? 'min-h-[58px] min-w-0 flex-1'
                  : 'min-h-[44px] min-w-[52px] max-w-[76px] shrink-0',
                isActive
                  ? isClientPortalTabs
                    ? 'text-[var(--cp-accent)]'
                    : 'bg-[var(--accent-light)] text-[var(--cp-accent)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'size-[22px] shrink-0 transition-transform duration-150',
                  isClientPortalTabs && 'stroke-[2]',
                  isActive ? 'text-[var(--cp-accent)]' : 'text-[var(--text-tertiary)]',
                  isActive && isClientPortalTabs ? 'scale-110' : ''
                )}
              />
              <span
                className={cn(
                  'line-clamp-1 w-full text-center',
                  isActive && isClientPortalTabs && 'text-[var(--cp-accent)]'
                )}
              >
                {label}
              </span>
              {isActive && isClientPortalTabs ? (
                <span className="absolute bottom-1 h-1 w-4 rounded-full bg-[var(--cp-accent)]" aria-hidden />
              ) : null}
              {showMsgBadge ? (
                <span
                  className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--cp-accent)] px-1 text-[10px] font-semibold text-[var(--text-on-accent)]"
                  aria-label={`${messageUnreadCount} unread messages`}
                >
                  {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                </span>
              ) : null}
              {showTasksBadge ? (
                <span
                  className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--cp-accent)] px-1 text-[10px] font-semibold text-[var(--text-on-accent)]"
                  aria-label={`${pendingAssignmentsCount} tasks due`}
                >
                  {pendingAssignmentsCount > 99 ? '99+' : pendingAssignmentsCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
