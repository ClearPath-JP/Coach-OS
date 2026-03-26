'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'

export interface SidebarNavItem {
  href: string
  label: string
  icon?: React.ReactNode
}

export interface SidebarNavSection {
  title: string
  items: SidebarNavItem[]
}

export interface SidebarUserBar {
  displayName: string
  roleLabel?: string
  avatarUrl?: string | null
  settingsHref?: string
}

export interface SidebarProps {
  wordmark?: boolean
  topItems?: SidebarNavItem[]
  sections?: SidebarNavSection[]
  items?: SidebarNavItem[]
  bottomItems?: SidebarNavItem[]
  header?: React.ReactNode
  footer?: React.ReactNode
  userBar?: SidebarUserBar
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? ''
    const b = parts[parts.length - 1]?.[0] ?? ''
    return (a + b).toUpperCase().slice(0, 2) || '?'
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function SettingsGearIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
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
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3.4a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5 8.89a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9.11 5c.7 0 1.33-.4 1.62-1.03V3.9a2 2 0 1 1 4 0v.07c.29.63.92 1.03 1.62 1.03a1.65 1.65 0 0 0 1.17-.48l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.6 1.16-.33 1.82.27.66.91 1.1 1.62 1.1h.09a2 2 0 1 1 0 4h-.09c-.71 0-1.35.44-1.62 1.1z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SidebarThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <div className="mt-2 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-muted)] px-2 py-1.5">
      <span className="text-[var(--text-tertiary)]" aria-hidden>
        <SunIcon />
      </span>
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'relative h-[22px] w-[38px] shrink-0 rounded-full border border-[var(--border-default)] transition-colors duration-[var(--duration-fast)]',
          isDark ? 'bg-[var(--accent)]' : 'bg-[var(--bg-app)]'
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[16px] w-[16px] rounded-full bg-[var(--bg-app)] shadow-[var(--shadow-xs)] transition-transform duration-[var(--duration-fast)]',
            isDark ? 'left-[18px]' : 'left-[2px]'
          )}
        />
      </button>
      <span className="text-[var(--text-tertiary)]" aria-hidden>
        <MoonIcon />
      </span>
    </div>
  )
}

function NavRows({
  items,
  pathname,
}: {
  items: SidebarNavItem[]
  pathname: string | null
}) {
  return (
    <>
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname != null && pathname.startsWith(item.href + '/'))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative mb-px flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2 text-[14px] no-underline transition-[color,background-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-out)]',
              isActive
                ? 'nav-item-active bg-[var(--accent-light)] font-medium text-[var(--accent)] [&_svg]:text-[var(--accent)]'
                : 'font-normal text-[var(--text-tertiary)] [&_svg]:text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] [&:hover_svg]:text-[var(--text-primary)]'
            )}
          >
            {item.icon ? (
              <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{item.icon}</span>
            ) : null}
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

export function Sidebar({
  wordmark,
  topItems = [],
  sections,
  items = [],
  bottomItems = [],
  header,
  footer,
  userBar,
  className,
}: SidebarProps) {
  const pathname = usePathname()
  const flatItems = sections ? [] : items
  const settingsHref = userBar?.settingsHref ?? '/coach/settings'

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-subtle)]',
        className
      )}
    >
      {wordmark ? (
        <div className="flex h-[52px] shrink-0 items-center border-b border-[var(--border-subtle)] px-4">
          <div className="size-5 shrink-0 rounded-[var(--radius-md)] bg-[var(--accent)]" aria-hidden />
          <span className="ml-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            ClearPath
          </span>
        </div>
      ) : null}
      {header ? (
        <div className="border-b border-[var(--border-subtle)] px-2 py-2">{header}</div>
      ) : null}

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {topItems.length > 0 ? (
          <div className="mb-1">
            <NavRows items={topItems} pathname={pathname} />
          </div>
        ) : null}

        {sections?.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
              {section.title}
            </p>
            <NavRows items={section.items} pathname={pathname} />
          </div>
        ))}

        {flatItems.length > 0 ? <NavRows items={flatItems} pathname={pathname} /> : null}

        {bottomItems.length > 0 ? (
          <div className="mt-auto flex flex-col border-t border-[var(--border-subtle)] pt-2">
            <NavRows items={bottomItems} pathname={pathname} />
          </div>
        ) : null}
      </nav>

      {userBar ? (
        <div className="shrink-0 border-t border-[var(--border-subtle)] p-2">
          <Link
            href={settingsHref}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 transition-[background-color] duration-[var(--duration-fast)] hover:bg-[var(--bg-muted)]"
          >
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-light)] text-[11px] font-semibold text-[var(--accent)]">
              {userBar.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- coach avatar from storage
                <img src={userBar.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                initials(userBar.displayName)
              )}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
              {userBar.displayName}
            </span>
            <SettingsGearIcon className="shrink-0 text-[var(--text-tertiary)]" />
          </Link>
          <SidebarThemeToggle />
        </div>
      ) : null}

      {footer && !userBar ? (
        <div className="border-t border-[var(--border-subtle)] p-2">{footer}</div>
      ) : null}
    </aside>
  )
}

export interface SidebarLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SidebarLayout({ sidebar, children, className }: SidebarLayoutProps) {
  return (
    <div className={cn('flex h-full min-h-screen w-full', className)}>
      {sidebar}
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
