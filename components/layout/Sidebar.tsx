'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { ClearPathLogo } from '@/components/layout/ClearPathLogo'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'

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
  variant?: 'default' | 'coach'
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
      width="13"
      height="13"
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

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  )
}

function useCoachSidebarBadges() {
  const [badges, setBadges] = useState({ messages: 0, assignments: 0 })
  const refresh = useCallback(() => {
    void Promise.all([
      fetch('/api/messages/unread-count', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/assignments/overview', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([msgJson, asgJson]) => {
        const msg = typeof msgJson?.data?.count === 'number' ? msgJson.data.count : 0
        let asg = 0
        if (asgJson?.data) {
          const pr = typeof asgJson.data.pendingReviewCount === 'number' ? asgJson.data.pendingReviewCount : 0
          const ov = typeof asgJson.data.overdueCount === 'number' ? asgJson.data.overdueCount : 0
          asg = pr + ov
        }
        setBadges({ messages: msg, assignments: asg })
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 60_000)
    return () => clearInterval(t)
  }, [refresh])
  return badges
}

function SidebarBrandMark({ invertLogo }: { invertLogo?: boolean }) {
  const { settings } = useWorkspace()
  const url = settings.logoUrl?.trim() ?? ''
  const [failedForUrl, setFailedForUrl] = useState<string | null>(null)
  const showCustomLogo = Boolean(url && failedForUrl !== url)

  if (showCustomLogo) {
    return (
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[#2a2a2a] bg-[#1e1e1e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          width={28}
          height={28}
          className="h-full w-full object-contain p-0.5"
          onError={() => setFailedForUrl(url)}
          loading="lazy"
        />
      </span>
    )
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center', invertLogo && '[&_svg]:brightness-0 [&_svg]:invert')}>
      <ClearPathLogo size={28} />
    </span>
  )
}

function SidebarWordmark() {
  const { settings } = useWorkspace()
  const displayName = settings.workspaceDisplayName || settings.brandName || 'ClearPath'
  const showPoweredBy = !!(settings.workspaceDisplayName || settings.brandName)

  return (
    <div className="flex items-center gap-2">
      <SidebarBrandMark />
      <div className="min-w-0">
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {displayName}
        </span>
        {showPoweredBy ? (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-quaternary)',
              letterSpacing: '0.02em',
              display: 'block',
              marginTop: '1px',
            }}
          >
            Powered by ClearPath
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CoachSidebarHeader() {
  const { settings } = useWorkspace()
  const displayName = settings.workspaceDisplayName || settings.brandName || 'ClearPath'
  const initial = (displayName.trim().slice(0, 1) || 'C').toUpperCase()

  return (
    <>
      <div
        className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4"
        style={{ borderColor: '#222222' }}
      >
        <SidebarBrandMark invertLogo />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-white">ClearPath</div>
          <div
            className="text-[10px] font-medium uppercase tracking-[0.1em]"
            style={{ color: 'var(--accent)' }}
          >
            Coach OS
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] py-1.5 pl-2 pr-2 transition-colors duration-[80ms] hover:bg-[#1e1e1e]"
          aria-label="Workspace"
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#e5e5e5]">{displayName}</span>
          <span className="shrink-0 text-[#555555]">
            <ChevronDownIcon />
          </span>
        </button>
      </div>
    </>
  )
}

function CoachSidebarSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative mx-3 mb-2">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#666666]" aria-hidden>
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        aria-label="Search navigation"
        className="h-8 w-full rounded-[6px] border bg-[#1e1e1e] py-0 pl-8 pr-2.5 text-[13px] text-[#cccccc] outline-none transition-[border-color,box-shadow] duration-[80ms] placeholder:text-[#666666] focus:border-[var(--accent)]"
        style={{
          borderColor: '#2a2a2a',
          boxShadow: undefined,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent)'
          e.target.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb), 0.2)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#2a2a2a'
          e.target.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

function CoachThemeToggleRow() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <div className="flex h-[30px] items-center gap-2 px-2">
      <span className="text-[#666666]" aria-hidden>
        <SunIcon size={14} />
      </span>
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-[80ms]',
          isDark ? 'border-transparent bg-[var(--accent)]' : 'border-[#2a2a2a] bg-[#1e1e1e]'
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-[80ms]',
            isDark ? 'left-[18px]' : 'left-[2px]'
          )}
        />
      </button>
      <span className="text-[#666666]" aria-hidden>
        <MoonIcon size={14} />
      </span>
      <span className="text-[13px] text-[#666666]">Dark mode</span>
    </div>
  )
}

function NavRowsDefault({
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

function SidebarThemeToggleFooter() {
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

function NavRowsCoach({
  items,
  pathname,
  badges,
  navFilter,
}: {
  items: SidebarNavItem[]
  pathname: string | null
  badges: { messages: number; assignments: number }
  navFilter: string
}) {
  const q = navFilter.trim().toLowerCase()
  return (
    <>
      {items.map((item) => {
        if (q && !item.label.toLowerCase().includes(q)) return null
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname != null && pathname.startsWith(item.href + '/'))
        const badge =
          item.href === '/coach/messages'
            ? badges.messages
            : item.href === '/coach/assignments'
              ? badges.assignments
              : 0
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative mb-px flex h-[30px] items-center gap-2 rounded-[5px] px-2 text-[13px] no-underline transition-[color,background-color] duration-[80ms] ease-out',
              isActive
                ? 'nav-item-active-coach bg-[#1e1e1e] font-medium text-white [&_svg]:text-[var(--accent)]'
                : 'font-normal text-[#888888] [&_svg]:text-[#555555] hover:bg-[#1e1e1e] hover:text-[#cccccc] [&:hover_svg]:text-[#bbbbbb]'
            )}
          >
            {item.icon ? (
              <span className="flex size-[15px] shrink-0 items-center justify-center [&>svg]:size-[15px]">{item.icon}</span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badge > 0 ? (
              <span
                className="badge shrink-0 rounded-full px-1.5 py-px text-center text-[10px] font-semibold text-white transition-[filter] duration-[80ms] hover:brightness-[0.9]"
                style={{
                  background: 'var(--accent)',
                  minWidth: '16px',
                }}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </>
  )
}

export function Sidebar({
  variant = 'default',
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
  const [navFilter, setNavFilter] = useState('')
  const coachBadges = useCoachSidebarBadges()

  const filteredSections = useMemo(() => {
    if (!sections || variant !== 'coach') return sections
    const q = navFilter.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0)
  }, [sections, navFilter, variant])

  if (variant === 'coach') {
    return (
      <aside
        className={cn(
          'coach-sidebar-dark flex h-[calc(100dvh-var(--nav-height))] w-[var(--sidebar-width)] shrink-0 flex-col overflow-hidden border-r bg-[#111111]',
          className
        )}
        style={{ borderColor: '#222222', zIndex: 40 }}
      >
        {wordmark ? <CoachSidebarHeader /> : null}
        {header ? <div className="border-b px-2 py-2" style={{ borderColor: '#222222' }}>{header}</div> : null}

        <CoachSidebarSearch value={navFilter} onChange={setNavFilter} />

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
          {topItems.length > 0 ? (
            <div className="mb-1">
              <NavRowsCoach items={topItems} pathname={pathname} badges={coachBadges} navFilter={navFilter} />
            </div>
          ) : null}

          {filteredSections?.map((section) => (
            <div key={section.title}>
              <p
                className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: '#444444' }}
              >
                {section.title}
              </p>
              <NavRowsCoach items={section.items} pathname={pathname} badges={coachBadges} navFilter="" />
            </div>
          ))}

          {flatItems.length > 0 ? (
            <NavRowsCoach items={flatItems} pathname={pathname} badges={coachBadges} navFilter={navFilter} />
          ) : null}

          {bottomItems.length > 0 ? (
            <div className="mt-auto flex flex-col border-t pt-2" style={{ borderColor: '#1e1e1e' }}>
              <NavRowsCoach items={bottomItems} pathname={pathname} badges={coachBadges} navFilter={navFilter} />
            </div>
          ) : null}
        </nav>

        {userBar ? (
          <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: '#1e1e1e' }}>
            <CoachThemeToggleRow />
            <Link
              href={settingsHref}
              className="mt-2 flex h-9 cursor-pointer items-center gap-2 rounded-[5px] px-2 transition-colors duration-[80ms] hover:bg-[#1e1e1e]"
            >
              <div className="avatar-hover flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
                {userBar.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- coach avatar from storage
                  <img src={userBar.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  initials(userBar.displayName)
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#888888]">{userBar.displayName}</span>
              <SettingsGearIcon className="shrink-0 text-[#444444]" />
            </Link>
            <div className="mt-2 px-0">
              <SignOutButton
                variant="sidebar"
                className="h-9 w-full rounded-[5px] px-2 text-[12px] text-[#666666] transition-colors duration-[80ms] hover:bg-[#1e1e1e] hover:text-[#cccccc]"
              />
            </div>
            <p className="mt-1 px-1 text-[10px] text-[#444444]">⌘K Quick actions</p>
          </div>
        ) : null}

        {footer && !userBar ? <div className="border-t p-2" style={{ borderColor: '#1e1e1e' }}>{footer}</div> : null}
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-subtle)]',
        className
      )}
    >
      {wordmark ? (
        <div className="flex shrink-0 items-start border-b border-[var(--border-subtle)] px-4 py-3">
          <SidebarWordmark />
        </div>
      ) : null}
      {header ? <div className="border-b border-[var(--border-subtle)] px-2 py-2">{header}</div> : null}

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {topItems.length > 0 ? (
          <div className="mb-1">
            <NavRowsDefault items={topItems} pathname={pathname} />
          </div>
        ) : null}

        {sections?.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
              {section.title}
            </p>
            <NavRowsDefault items={section.items} pathname={pathname} />
          </div>
        ))}

        {flatItems.length > 0 ? <NavRowsDefault items={flatItems} pathname={pathname} /> : null}

        {bottomItems.length > 0 ? (
          <div className="mt-auto flex flex-col border-t border-[var(--border-subtle)] pt-2">
            <NavRowsDefault items={bottomItems} pathname={pathname} />
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
          <SidebarThemeToggleFooter />
          <div className="mt-2 px-1">
            <SignOutButton
              variant="sidebar"
              className="min-h-[40px] rounded-[var(--radius-md)] px-2 py-2 text-[13px] text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            />
          </div>
          <p className="mt-1 px-1 text-[11px] text-[var(--text-quaternary)]">⌘K Quick actions</p>
        </div>
      ) : null}

      {footer && !userBar ? <div className="border-t border-[var(--border-subtle)] p-2">{footer}</div> : null}
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
