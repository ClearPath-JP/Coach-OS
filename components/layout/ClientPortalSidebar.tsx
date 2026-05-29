'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  BookOpen,
  Target,
  Calendar,
  Ticket,
  MessageSquare,
  Receipt,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientPortalSidebarFooter } from '@/components/layout/ClientPortalSidebarFooter'

const PRIMARY: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/client/portal', label: 'Home', Icon: LayoutDashboard },
  { href: '/client/classes', label: 'Book a class', Icon: Ticket },
  { href: '/client/sessions', label: 'My sessions', Icon: Calendar },
  { href: '/client/programs', label: 'Programs', Icon: BookOpen },
  { href: '/client/goals', label: 'Goals', Icon: Target },
  { href: '/client/messages', label: 'Messages', Icon: MessageSquare },
  { href: '/client/invoices', label: 'Invoices', Icon: Receipt },
]

function NavRows({
  items,
  pathname,
}: {
  items: { href: string; label: string; Icon: LucideIcon }[]
  pathname: string | null
}) {
  return (
    <>
      {items.map(({ href, label, Icon }) => {
        const isActive =
          href === '/client/portal'
            ? pathname === href
            : pathname === href || (pathname != null && pathname.startsWith(`${href}/`))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative mb-px flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-2 text-[14px] no-underline transition-[color,background-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-out)]',
              isActive
                ? 'bg-[var(--accent-light)] font-medium text-[var(--cp-accent)] [&_svg]:text-[var(--cp-accent)]'
                : 'font-normal text-[var(--text-tertiary)] [&_svg]:text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] [&:hover_svg]:text-[var(--text-primary)]'
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        )
      })}
    </>
  )
}

/** Desktop left rail: full client destinations + Profile; footer = Powered by FoundOS. */
export function ClientPortalDesktopSidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const profileActive = pathname === '/client/profile' || pathname?.startsWith('/client/profile/')

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]',
        className
      )}
    >
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        <NavRows items={PRIMARY} pathname={pathname} />
        <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
          <Link
            href="/client/profile"
            className={cn(
              'relative mb-px flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-2 text-[14px] no-underline transition-[color,background-color] duration-[var(--duration-fast)]',
              profileActive
                ? 'bg-[var(--accent-light)] font-medium text-[var(--cp-accent)] [&_svg]:text-[var(--cp-accent)]'
                : 'font-normal text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <User className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Profile
          </Link>
        </div>
      </nav>
      <ClientPortalSidebarFooter />
    </aside>
  )
}
