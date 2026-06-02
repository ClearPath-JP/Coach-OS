'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OPEN_COMMAND_PALETTE_EVENT } from '@/lib/command-palette'

type CommandItem = {
  id: string
  section: 'Navigation' | 'Actions' | 'Settings'
  label: string
  shortcut?: string
  run: () => void
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return t.isContentEditable
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const items: CommandItem[] = useMemo(
    () => [
      { id: 'n-dash', section: 'Navigation', label: 'Go to Dashboard', run: () => router.push('/coach/dashboard') },
      { id: 'n-sched', section: 'Navigation', label: 'Go to Schedule', run: () => router.push('/coach/schedule') },
      { id: 'n-class', section: 'Navigation', label: 'Go to Classes', run: () => router.push('/coach/classes') },
      { id: 'n-clients', section: 'Navigation', label: 'Go to Clients', run: () => router.push('/coach/clients') },
      { id: 'n-msg', section: 'Navigation', label: 'Go to Messages', run: () => router.push('/coach/messages') },
      { id: 'n-prog', section: 'Navigation', label: 'Go to Programs', run: () => router.push('/coach/programs') },
      { id: 'n-pack', section: 'Navigation', label: 'Go to Packages', run: () => router.push('/coach/packages') },
      { id: 'n-member', section: 'Navigation', label: 'Go to Memberships', run: () => router.push('/coach/memberships') },
      { id: 'n-pay', section: 'Navigation', label: 'Go to Payments', run: () => router.push('/coach/payments') },
      { id: 'n-inv', section: 'Navigation', label: 'Go to Invoices', run: () => router.push('/coach/invoices') },
      { id: 'n-ana', section: 'Navigation', label: 'Go to Analytics', run: () => router.push('/coach/analytics') },
      { id: 'n-promo', section: 'Navigation', label: 'Go to Promote', run: () => router.push('/coach/promote') },
      { id: 'n-leads', section: 'Navigation', label: 'Go to Lead Research', run: () => router.push('/coach/leads') },
      { id: 'n-vid', section: 'Navigation', label: 'Go to Videos', run: () => router.push('/coach/videos') },
      { id: 'a-book', section: 'Actions', label: 'Book a session', shortcut: 'B', run: () => router.push('/coach/schedule') },
      { id: 'a-client', section: 'Actions', label: 'Add a client', shortcut: 'C', run: () => router.push('/coach/clients') },
      { id: 'a-msg', section: 'Actions', label: 'Message a client', shortcut: 'M', run: () => router.push('/coach/messages') },
      { id: 'a-pay', section: 'Actions', label: 'Record a payment', shortcut: 'P', run: () => router.push('/coach/payments') },
      { id: 's-sub', section: 'Settings', label: 'Subscription', run: () => router.push('/coach/subscription') },
      { id: 's-set', section: 'Settings', label: 'Settings', run: () => router.push('/coach/settings') },
    ],
    [router]
  )

  const filtered = useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setQuery('')
      setSelected(0)
    }
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (!isTypingTarget(e.target) && e.key === '/') {
        e.preventDefault()
        setOpen(true)
      }
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown') setSelected((s) => Math.min(s + 1, Math.max(filtered.length - 1, 0)))
      if (e.key === 'ArrowUp') setSelected((s) => Math.max(s - 1, 0))
      if (e.key === 'Enter' && filtered[selected]) {
        filtered[selected].run()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, selected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-[4px]">
      <button type="button" className="absolute inset-0" aria-label="Close command palette" onClick={() => setOpen(false)} />
      <div className="gloss-glass relative z-10 w-full max-w-[640px] overflow-hidden rounded-[var(--radius-xl)]">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          placeholder="Search or jump to..."
          className="h-[52px] w-full border-b border-[var(--border-default)] bg-transparent px-4 text-[16px] outline-none"
        />
        <div className="max-h-[400px] overflow-y-auto p-2">
          {(['Navigation', 'Actions', 'Settings'] as const).map((section) => {
            const sectionItems = filtered.filter((f) => f.section === section)
            if (sectionItems.length === 0) return null
            return (
              <div key={section}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-quaternary)]">{section}</p>
                {sectionItems.map((item) => {
                  const idx = filtered.findIndex((f) => f.id === item.id)
                  const active = idx === selected
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.run()
                        setOpen(false)
                      }}
                      className={`flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-left ${active ? 'bg-[var(--accent-surface)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-subtle)]'}`}
                    >
                      <span className="text-[14px] text-[var(--text-primary)]">{item.label}</span>
                      {item.shortcut ? <span className="ml-auto rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">{item.shortcut}</span> : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
