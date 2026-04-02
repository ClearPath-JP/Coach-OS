'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Nav } from '@/components/layout/Nav'
import { ClientNotificationsBell } from '@/components/layout/ClientNotificationsBell'
import { ClientPortalDesktopSidebar } from '@/components/layout/ClientPortalSidebar'
import { MobileNav, clientPortalTabs } from '@/components/layout/MobileNav'

const UNREAD_POLL_MS = 30_000
const CHECKIN_POLL_MS = 60_000

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
  const [checkInReminderDot, setCheckInReminderDot] = useState(false)
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

  const fetchCheckinToday = useCallback(async () => {
    try {
      const res = await fetch('/api/client/checkin/today', { credentials: 'include' })
      const json = (await res.json()) as { data?: { checkin: unknown | null } }
      if (res.ok && json.data) {
        setCheckInReminderDot(!json.data.checkin)
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
    const interval = setInterval(() => void fetchCheckinToday(), CHECKIN_POLL_MS)
    queueMicrotask(() => void fetchCheckinToday())
    return () => clearInterval(interval)
  }, [fetchCheckinToday])

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

  useEffect(() => {
    const handler = () => void fetchCheckinToday()
    window.addEventListener('clearpath:checkin-updated', handler)
    return () => window.removeEventListener('clearpath:checkin-updated', handler)
  }, [fetchCheckinToday])

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-[var(--bg-app)] lg:grid lg:h-[100dvh] lg:grid-rows-[var(--nav-height)_minmax(0,1fr)] lg:overflow-hidden">
      <Nav
        userDisplayName={userDisplayName}
        logoHref="/client/portal"
        brandName={brandName}
        showThemeToggle
        clientPortal
        clientPortalTrailing={<ClientNotificationsBell />}
        className="w-full shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-row lg:min-h-0 lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 lg:flex lg:w-[var(--sidebar-width)] lg:shrink-0 lg:flex-col lg:border-r lg:border-[var(--border-default)] lg:bg-[var(--bg-subtle)]">
          <ClientPortalDesktopSidebar className="h-full min-h-0 flex-1 border-0" />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-20 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
          {children}
          <div className="mt-auto flex shrink-0 justify-center px-4 pb-2 pt-4 text-center text-[11px] text-[var(--text-quaternary)] lg:pb-4">
            Powered by <span className="font-medium text-[var(--accent)]">ClearPath</span>
          </div>
        </div>
      </div>
      <MobileNav
        tabs={clientPortalTabs}
        messageUnreadCount={unreadCount}
        checkInReminderDot={checkInReminderDot}
      />
    </div>
  )
}
