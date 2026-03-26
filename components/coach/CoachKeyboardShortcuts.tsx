'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const CHORD_MS = 1400

const G_MAP: Record<string, string> = {
  d: '/coach/dashboard',
  c: '/coach/clients',
  m: '/coach/messages',
  s: '/coach/schedule',
  p: '/coach/programs',
  v: '/coach/videos',
  a: '/coach/analytics',
  i: '/coach/invoices',
  y: '/coach/payments',
  k: '/coach/packages',
  b: '/billing',
  t: '/coach/settings',
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return t.isContentEditable
}

const SHORTCUT_ROWS: { keys: string; label: string }[] = [
  { keys: 'G then D', label: 'Dashboard' },
  { keys: 'G then C', label: 'Clients' },
  { keys: 'G then M', label: 'Messages' },
  { keys: 'G then S', label: 'Schedule' },
  { keys: 'G then P', label: 'Programs' },
  { keys: 'G then V', label: 'Videos' },
  { keys: 'G then A', label: 'Analytics' },
  { keys: 'G then I', label: 'Invoices' },
  { keys: 'G then Y', label: 'Payments' },
  { keys: 'G then K', label: 'Packages' },
  { keys: 'G then B', label: 'Billing' },
  { keys: 'G then T', label: 'Settings' },
]

/**
 * Linear-style g-chord navigation + ? help modal. Skips when typing in inputs.
 */
export function CoachKeyboardShortcuts() {
  const router = useRouter()
  const chordRef = useRef(false)
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const clearChord = useCallback(() => {
    chordRef.current = false
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current)
      chordTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          setHelpOpen(true)
          clearChord()
        }
        return
      }

      if (helpOpen && e.key === 'Escape') {
        setHelpOpen(false)
        return
      }

      if (isTypingTarget(e.target)) {
        clearChord()
        return
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setHelpOpen((v) => !v)
        clearChord()
        return
      }

      const k = e.key.toLowerCase()

      if (chordRef.current) {
        const path = G_MAP[k]
        if (path) {
          e.preventDefault()
          clearChord()
          router.push(path)
        } else {
          clearChord()
        }
        return
      }

      if (k === 'g') {
        e.preventDefault()
        chordRef.current = true
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current)
        chordTimerRef.current = setTimeout(() => {
          chordRef.current = false
          chordTimerRef.current = null
        }, CHORD_MS)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current)
    }
  }, [router, clearChord, helpOpen])

  if (!helpOpen) return null

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={() => setHelpOpen(false)}
      />
      <div
        className={cn(
          'relative max-h-[85vh] w-full max-w-md overflow-auto rounded-[var(--radius-lg)] border border-[var(--border-default)]',
          'bg-[var(--bg-app)] p-6 shadow-[var(--shadow-xl)]'
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Keyboard shortcuts
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              Press{' '}
              <kbd className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]">
                G
              </kbd>{' '}
              then a letter to navigate.{' '}
              <kbd className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]">
                ?
              </kbd>{' '}
              opens this panel.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-[var(--radius-md)] px-2 py-1 text-[13px] text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
            onClick={() => setHelpOpen(false)}
          >
            Esc
          </button>
        </div>
        <ul className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
          {SHORTCUT_ROWS.map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-4 text-[13px]">
              <span className="text-[var(--text-secondary)]">{row.label}</span>
              <kbd className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 font-mono text-[12px] text-[var(--text-primary)]">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
