'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Nav } from '@/components/layout/Nav'
import { ClientPortalDesktopSidebar } from '@/components/layout/ClientPortalSidebar'
import { MobileNav, clientPortalTabs } from '@/components/layout/MobileNav'

const UNREAD_POLL_MS = 30_000

export function ClientLayoutWithUnread({
  children,
  userDisplayName,
  brandName,
}: {
  children: React.ReactNode
  userDisplayName: string | null
  /** Coach white-label name for nav logo */
  brandName?: string | null
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread-count')
      const json = await res.json()
      if (res.ok && typeof json.data?.count === 'number') {
        setUnreadCount(json.data.count)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => void fetchUnread(), UNREAD_POLL_MS)
    queueMicrotask(() => void fetchUnread())
    return () => clearInterval(interval)
  }, [fetchUnread])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      const channel = supabase
        .channel('unread-messages')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => {
            if (!cancelled) fetchUnread()
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          () => {
            if (!cancelled) fetchUnread()
          }
        )
        .subscribe()
      channelRef.current = channel
    })
    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, fetchUnread])

  useEffect(() => {
    const handler = () => void fetchUnread()
    window.addEventListener('clearpath:unread-messages-updated', handler)
    return () => window.removeEventListener('clearpath:unread-messages-updated', handler)
  }, [fetchUnread])

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-[var(--color-bg)] lg:h-[100dvh] lg:overflow-hidden">
      <Nav
        userDisplayName={userDisplayName}
        logoHref="/client/portal"
        brandName={brandName}
        showThemeToggle
        clientPortal
        className="w-full shrink-0 bg-[var(--color-bg)]"
      />
      <div className="flex min-h-0 flex-1 flex-row">
        <aside className="hidden lg:flex lg:w-[240px] lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--color-border)] lg:bg-[var(--color-surface)]">
          <ClientPortalDesktopSidebar className="flex-1 min-h-0 border-0" />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-16 lg:min-h-0 lg:overflow-hidden lg:pb-0">
          {children}
          <div className="mt-auto flex shrink-0 justify-center px-4 pb-2 pt-4 text-center text-[12px] text-[var(--color-muted)] lg:pb-4">
            Powered by{' '}
            <span className="font-medium text-[var(--color-accent)]">ClearPath</span>
          </div>
        </div>
      </div>
      <MobileNav tabs={clientPortalTabs} messageUnreadCount={unreadCount} />
    </div>
  )
}
