'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [badges, setBadges] = useState({ assignments: 0 })
  const refresh = useCallback(() => {
    fetch('/api/assignments/overview', { credentials: 'include' })
      .then((r) => r.json())
      .then((asgJson) => {
        let asg = 0
        if (asgJson?.data) {
          const pr = typeof asgJson.data.pendingReviewCount === 'number' ? asgJson.data.pendingReviewCount : 0
          const ov = typeof asgJson.data.overdueCount === 'number' ? asgJson.data.overdueCount : 0
          asg = pr + ov
        }
        setBadges({ assignments: asg })
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
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
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
  const workspaceName = settings.workspaceDisplayName || settings.brandName

  return (
    <div className="flex items-center gap-2">
      <SidebarBrandMark />
      <div className="min-w-0">
        <span
          className="block font-display text-[15px] font-semibold tracking-[0.12em]"
          aria-label="Kindo"
        >
          <span className="text-[var(--text-primary)]">KIN</span>
          <span style={{ color: 'var(--accent)' }}>DO</span>
        </span>
        {workspaceName ? (
          <span
            className="block max-w-[160px] truncate text-[10px] font-normal tracking-[0.02em]"
            style={{ color: 'var(--text-quaternary)', marginTop: 1 }}
          >
            {workspaceName}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CoachSidebarHeader() {
  const { settings } = useWorkspace()
  const workspaceName = settings.workspaceDisplayName || settings.brandName

  return (
    <div
      className="flex h-[52px] shrink-0 items-center gap-2.5 px-4"
      style={{ borderBottom: '1px solid var(--coach-sidebar-border)' }}
    >
      <SidebarBrandMark invertLogo />
      <div className="min-w-0 flex-1 leading-tight">
        <div
          className="font-display text-[15px] font-semibold tracking-[0.12em]"
          aria-label="Kindo"
        >
          <span className="text-[var(--text-primary)]">KIN</span>
          <span style={{ color: 'var(--accent)' }}>DO</span>
        </div>
        {workspaceName ? (
          <div
            className="truncate text-[10px] font-normal tracking-[0.02em]"
            style={{ color: 'var(--coach-sidebar-muted)', marginTop: 1 }}
          >
            {workspaceName}
          </div>
        ) : null}
      </div>
    </div>
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
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)]" aria-hidden>
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        aria-label="Search navigation"
        className="h-8 w-full rounded-[6px] border border-[var(--coach-sidebar-input-border)] bg-[var(--coach-sidebar-input-bg)] py-0 pl-8 pr-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-[80ms] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)]"
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent)'
          e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb), 0.15)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--coach-sidebar-input-border)'
          e.target.style.boxShadow = 'none'
        }}
      />
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
                ? 'nav-item-active bg-[var(--accent-light)] font-medium text-[var(--cp-accent)] [&_svg]:text-[var(--cp-accent)]'
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

function NavRowsCoach({
  items,
  pathname,
  badges,
  navFilter,
}: {
  items: SidebarNavItem[]
  pathname: string | null
  badges: { assignments: number }
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
        const badge = item.href === '/coach/assignments' ? badges.assignments : 0
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative mb-[2px] flex h-[34px] items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] no-underline transition-all duration-[200ms] ease-out',
              isActive
                ? 'nav-item-active-coach bg-[var(--accent-surface)] font-medium text-[var(--text-primary)] [&_svg]:text-[var(--accent)]'
                : 'font-normal text-[var(--text-tertiary)] [&_svg]:text-[var(--coach-sidebar-icon)] hover:bg-[var(--coach-sidebar-hover)] hover:text-[var(--text-secondary)] [&:hover_svg]:text-[var(--text-tertiary)]'
            )}
          >
            {item.icon ? (
              <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{item.icon}</span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badge > 0 ? (
              <span
                className="badge shrink-0 rounded-full px-1.5 py-px text-center text-[10px] font-semibold transition-[filter] duration-[180ms] hover:brightness-[0.9]"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--bg-app)',
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
          'coach-sidebar-dark flex h-[calc(100dvh-var(--nav-height))] w-[var(--sidebar-width)] shrink-0 flex-col overflow-hidden border-r bg-[var(--coach-sidebar-bg)]',
          className
        )}
        style={{ borderColor: 'var(--coach-sidebar-border)', zIndex: 40 }}
      >
        {wordmark ? <CoachSidebarHeader /> : null}
        {header ? <div className="border-b px-2 py-2" style={{ borderColor: 'var(--coach-sidebar-border)' }}>{header}</div> : null}

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
                className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--coach-sidebar-label)' }}
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
            <div className="mt-auto flex flex-col border-t pt-2" style={{ borderColor: 'var(--coach-sidebar-border)' }}>
              <NavRowsCoach items={bottomItems} pathname={pathname} badges={coachBadges} navFilter={navFilter} />
            </div>
          ) : null}
        </nav>

        {userBar ? (
          <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: 'var(--coach-sidebar-border)' }}>
            <Link
              href={settingsHref}
              className="mt-2 flex h-10 cursor-pointer items-center gap-2.5 rounded-[8px] px-2 transition-colors duration-[180ms] hover:bg-[var(--coach-sidebar-hover)]"
            >
              <div className="avatar-hover flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold" style={{ background: 'var(--accent)', color: 'var(--bg-app)' }}>
                {userBar.avatarUrl ? (
                  <Image
                    src={userBar.avatarUrl}
                    alt={`${userBar.displayName} avatar`}
                    width={24}
                    height={24}
                    className="size-full object-cover"
                  />
                ) : (
                  initials(userBar.displayName)
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-tertiary)]">{userBar.displayName}</span>
              <SettingsGearIcon className="shrink-0 text-[var(--text-quaternary)]" />
            </Link>
            <div className="mt-2 px-0">
              <SignOutButton
                variant="sidebar"
                className="h-9 w-full rounded-[8px] px-2 text-[12px] text-[var(--text-tertiary)] transition-colors duration-[180ms] hover:bg-[var(--coach-sidebar-hover)] hover:text-[var(--text-primary)]"
              />
            </div>
            <div className="mt-2 flex items-center justify-end px-1">
              <span className="text-[10px] text-[var(--text-quaternary)]">⌘K</span>
            </div>
          </div>
        ) : null}

        {footer && !userBar ? <div className="border-t p-2" style={{ borderColor: 'var(--coach-sidebar-border)' }}>{footer}</div> : null}
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
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-light)] text-[11px] font-semibold text-[var(--cp-accent)]">
              {userBar.avatarUrl ? (
                <Image
                  src={userBar.avatarUrl}
                  alt={`${userBar.displayName} avatar`}
                  width={24}
                  height={24}
                  className="size-full object-cover"
                />
              ) : (
                initials(userBar.displayName)
              )}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
              {userBar.displayName}
            </span>
            <SettingsGearIcon className="shrink-0 text-[var(--text-tertiary)]" />
          </Link>
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
