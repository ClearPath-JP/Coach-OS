'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
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
  const { toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const items: CommandItem[] = useMemo(
    () => [
      { id: 'gd', section: 'Navigation', label: 'Go to Dashboard', shortcut: 'G D', run: () => router.push('/coach/dashboard') },
      { id: 'gc', section: 'Navigation', label: 'Go to Clients', shortcut: 'G C', run: () => router.push('/coach/clients') },
      { id: 'gm', section: 'Navigation', label: 'Go to Messages', shortcut: 'G M', run: () => router.push('/coach/messages') },
      { id: 'gk', section: 'Navigation', label: 'Go to Calendar', shortcut: 'G K', run: () => router.push('/coach/schedule') },
      { id: 'gp', section: 'Navigation', label: 'Go to Programs', shortcut: 'G P', run: () => router.push('/coach/programs') },
      { id: 'ga', section: 'Navigation', label: 'Go to Analytics', shortcut: 'G A', run: () => router.push('/coach/analytics') },
      { id: 'ac', section: 'Actions', label: 'Add new client', shortcut: 'C', run: () => router.push('/coach/clients') },
      { id: 'ab', section: 'Actions', label: 'Book a session', shortcut: 'B', run: () => router.push('/coach/schedule') },
      { id: 'ai', section: 'Actions', label: 'Send invoice', shortcut: 'I', run: () => router.push('/coach/invoices') },
      { id: 'ap', section: 'Actions', label: 'Record payment', shortcut: 'P', run: () => router.push('/coach/payments') },
      { id: 'ar', section: 'Actions', label: 'Create program', shortcut: 'R', run: () => router.push('/coach/programs') },
      { id: 'sd', section: 'Settings', label: 'Toggle dark mode', run: () => toggleTheme() },
      { id: 'sc', section: 'Settings', label: 'Change color theme', run: () => router.push('/coach/settings') },
      { id: 'ss', section: 'Settings', label: 'Go to settings', run: () => router.push('/coach/settings') },
      { id: 'so', section: 'Settings', label: 'Sign out', run: () => router.push('/login') },
    ],
    [router, toggleTheme]
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
      <div className="relative z-10 w-full max-w-[640px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] shadow-[var(--shadow-xl)]">
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
                      className={`flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-left ${active ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--bg-subtle)]'}`}
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
