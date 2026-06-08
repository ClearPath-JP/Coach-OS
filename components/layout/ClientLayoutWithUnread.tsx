'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Nav } from '@/components/layout/Nav'
import { ClientNotificationsBell } from '@/components/layout/ClientNotificationsBell'
import { ClientPortalDesktopSidebar } from '@/components/layout/ClientPortalSidebar'
import { MobileNav, clientPortalTabs } from '@/components/layout/MobileNav'

const UNREAD_POLL_MS = 30_000
const ASSIGNMENTS_POLL_MS = 60_000

export function ClientLayoutWithUnread({
  children,
  userDisplayName,
  brandName,
  brandTagline,
  logoUrl,
}: {
  children: React.ReactNode
  userDisplayName: string | null
  /** Coach white-label name for nav (fallback if no logo) */
  brandName?: string | null
  brandTagline?: string | null
  logoUrl?: string | null
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingAssignmentsCount, setPendingAssignmentsCount] = useState(0)
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

  const fetchPendingAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/client/assignments', { credentials: 'include' })
      const json = (await res.json()) as { data?: { status?: string }[] }
      if (!res.ok || !Array.isArray(json.data)) return
      const n = json.data.filter((a) => a.status === 'pending' || a.status === 'returned').length
      setPendingAssignmentsCount(n)
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
    const interval = setInterval(() => void fetchPendingAssignments(), ASSIGNMENTS_POLL_MS)
    queueMicrotask(() => void fetchPendingAssignments())
    return () => clearInterval(interval)
  }, [fetchPendingAssignments])

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
    const handler = () => void fetchPendingAssignments()
    window.addEventListener('clearpath:assignments-updated', handler)
    return () => window.removeEventListener('clearpath:assignments-updated', handler)
  }, [fetchPendingAssignments])

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-[var(--cp-offwhite)] lg:grid lg:h-[100dvh] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      <Nav
        userDisplayName={userDisplayName}
        logoHref="/client/portal"
        brandName={brandName}
        clientPortalLogoUrl={logoUrl ?? null}
        clientPortalBrandTagline={brandTagline ?? null}
        clientPortal
        clientPortalTrailing={<ClientNotificationsBell />}
        className="w-full shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-row lg:min-h-0 lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <div className="hidden min-h-0 lg:block">
          <ClientPortalDesktopSidebar className="h-full min-h-0" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-[88px] lg:min-h-0 lg:overflow-y-auto lg:pb-0">
          {children}
          <div className="mt-auto flex shrink-0 justify-center px-4 pb-2 pt-4 text-center text-[11px] text-[var(--text-quaternary)] lg:hidden">
            Powered by <span className="font-medium text-[var(--cp-accent)]">Korva</span>
          </div>
        </div>
      </div>
      <MobileNav
        tabs={clientPortalTabs}
        messageUnreadCount={unreadCount}
        pendingAssignmentsCount={pendingAssignmentsCount}
      />
    </div>
  )
}
