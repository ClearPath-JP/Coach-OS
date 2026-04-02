'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

type NotifItem = {
  id: string
  title: string
  body: string
  href: string
  createdAt: string
}

export function ClientNotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/notifications', { credentials: 'include' })
      const json = (await res.json()) as { data?: { items?: NotifItem[] } }
      if (res.ok && json.data?.items) {
        setItems(json.data.items)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 45_000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const count = items.length

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load()
        }}
        className="relative flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] lg:size-9 lg:min-h-9 lg:min-w-9"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-[var(--error)] text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-[120] w-[min(100vw-2rem,320px)] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)]">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">Notifications</p>
          </div>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">Loading…</p>
            ) : items.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-[14px] font-medium text-[var(--text-primary)]">You&apos;re all caught up</p>
                <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">No new session notes</p>
              </div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block border-b border-[var(--border-subtle)] px-4 py-3 text-left hover:bg-[var(--bg-subtle)]'
                  )}
                >
                  <span className="block text-[13px] font-medium text-[var(--text-primary)]">{n.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-tertiary)]">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-[var(--text-quaternary)]">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
