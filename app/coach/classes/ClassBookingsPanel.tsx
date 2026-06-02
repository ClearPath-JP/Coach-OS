'use client'

/**
 * ClassBookingsPanel — right-slide-out drawer for a single class occurrence.
 *
 * Shows the paid roster, attendance checkboxes (optimistic PATCH), and a
 * "Message all booked" footer that posts to /api/messages/broadcast.
 *
 * TODO: add MEMBER tag badge once memberships are built — each roster row has
 * a placeholder comment below where the badge will appear.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, Users, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RosterEntry {
  sessionId: string
  clientId: string | null
  name: string
  email: string | null
  photoUrl: string | null
  bookedAt: string
  attended: boolean | null
}

interface BookingsResponse {
  data: {
    roster: RosterEntry[]
    clientIds: string[]
  }
}

export interface ClassBookingsPanelProps {
  open: boolean
  classGroupId: string | null
  className: string | null
  date: string | null
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Only allow https:// or data: URLs — reject anything else. */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'data:'
  } catch {
    return false
  }
}

/** Initials from a name string (max 2 chars). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

/** Deterministic hue 0–359 from a string. */
function avatarHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

/** Format YYYY-MM-DD as "Mon, Jun 2" */
function fmtDate(dateStr: string): string {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  if (!yyyy || !mm || !dd) return dateStr
  const d = new Date(yyyy, mm - 1, dd)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Format ISO timestamp as "Jun 1 at 3:04 PM" */
function fmtBookedAt(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const hue = avatarHue(name)
  const safePhoto = photoUrl && isSafeUrl(photoUrl) ? photoUrl : null
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-white select-none"
      style={{ background: safePhoto ? undefined : `hsl(${hue} 50% 38%)` }}
      title={name}
    >
      {safePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safePhoto} alt={name} width={36} height={36} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Attendance checkbox row
// ---------------------------------------------------------------------------

interface RosterRowProps {
  entry: RosterEntry
  onToggle: (sessionId: string, attended: boolean) => void
  patching: boolean
}

function RosterRow({ entry, onToggle, patching }: RosterRowProps) {
  const checked = entry.attended === true

  return (
    <li className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2.5">
      <Avatar name={entry.name} photoUrl={entry.photoUrl} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {entry.name}
          </span>
          {/* TODO: MEMBER badge goes here once memberships are built */}
        </div>
        <p className="text-[11px] text-[var(--text-quaternary)] truncate">
          Booked {fmtBookedAt(entry.bookedAt)}
        </p>
      </div>

      {/* Attendance checkbox */}
      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none group" title="Mark attended">
        <input
          type="checkbox"
          checked={checked}
          disabled={patching}
          onChange={(e) => onToggle(entry.sessionId, e.target.checked)}
          className="sr-only"
        />
        {/* Custom checkbox visual */}
        <span
          aria-hidden="true"
          className={[
            'flex size-5 items-center justify-center rounded border transition-colors',
            checked
              ? 'border-[var(--accent)] bg-[var(--accent)]'
              : 'border-[var(--border-default)] bg-[var(--bg-app)] group-hover:border-[var(--accent)]/50',
            patching ? 'opacity-50' : '',
          ].join(' ')}
        >
          {checked && (
            <svg
              className="size-3 text-white"
              fill="none"
              viewBox="0 0 12 12"
              strokeWidth={2.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          )}
        </span>
        <span className="text-[10px] font-medium text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]">
          {checked ? 'Attended' : 'Mark'}
        </span>
      </label>
    </li>
  )
}

// ---------------------------------------------------------------------------
// ClassBookingsPanel
// ---------------------------------------------------------------------------

export function ClassBookingsPanel({
  open,
  classGroupId,
  className,
  date,
  onClose,
}: ClassBookingsPanelProps) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [clientIds, setClientIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Per-row patching set (sessionIds currently being PATCH-ed)
  const [patching, setPatching] = useState<Set<string>>(new Set())

  // Broadcast message state
  const [msgOpen, setMsgOpen] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'sent' | 'error' | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const panelRef = useRef<HTMLElement>(null)

  // ---------------------------------------------------------------------------
  // Fetch roster when panel opens / target changes
  // ---------------------------------------------------------------------------

  const fetchRoster = useCallback(async () => {
    if (!classGroupId || !date) return
    setLoading(true)
    setFetchError(null)
    setRoster([])
    setClientIds([])
    // Reset message UI when navigating to a different session
    setMsgOpen(false)
    setMsgText('')
    setSendResult(null)
    setSendError(null)
    try {
      const res = await fetch(
        `/api/coach/classes/${encodeURIComponent(classGroupId)}/bookings?date=${encodeURIComponent(date)}`
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as Record<string, unknown>
        const msg = typeof json.error === 'string' ? json.error : 'Could not load bookings'
        setFetchError(msg)
        return
      }
      const json = (await res.json()) as BookingsResponse
      setRoster(json.data.roster ?? [])
      setClientIds(json.data.clientIds ?? [])
    } catch {
      setFetchError('Network error — check your connection.')
    } finally {
      setLoading(false)
    }
  }, [classGroupId, date])

  useEffect(() => {
    if (open && classGroupId && date) {
      void fetchRoster()
    }
  }, [open, classGroupId, date, fetchRoster])

  // ---------------------------------------------------------------------------
  // Escape key
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // ---------------------------------------------------------------------------
  // Attendance toggle — optimistic + revert on failure
  // ---------------------------------------------------------------------------

  async function handleToggleAttendance(sessionId: string, attended: boolean) {
    // Null-guard: classGroupId must be set for any roster row to be rendered
    if (!classGroupId) return

    // Optimistic update
    setRoster((prev) =>
      prev.map((r) => (r.sessionId === sessionId ? { ...r, attended } : r))
    )
    setPatching((prev) => new Set([...prev, sessionId]))

    try {
      const res = await fetch(`/api/coach/classes/${encodeURIComponent(classGroupId)}/bookings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, attended }),
      })

      if (!res.ok) {
        // Revert on failure
        setRoster((prev) =>
          prev.map((r) => (r.sessionId === sessionId ? { ...r, attended: !attended } : r))
        )
      }
    } catch {
      // Revert on network error
      setRoster((prev) =>
        prev.map((r) => (r.sessionId === sessionId ? { ...r, attended: !attended } : r))
      )
    } finally {
      setPatching((prev) => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcast message
  // ---------------------------------------------------------------------------

  async function handleSendMessage() {
    if (!msgText.trim() || clientIds.length === 0) return
    setSending(true)
    setSendResult(null)
    setSendError(null)
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: msgText.trim(),
          clientIds,
        }),
      })
      const json = await res.json().catch(() => ({})) as Record<string, unknown>
      if (!res.ok) {
        const msg = typeof json.error === 'string' ? json.error : 'Could not send message'
        setSendError(msg)
        setSendResult('error')
        return
      }
      setSendResult('sent')
      setMsgText('')
    } catch {
      setSendError('Network error — check your connection.')
      setSendResult('error')
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render — nothing when closed
  // ---------------------------------------------------------------------------

  if (!open) return null

  const formattedDate = date ? fmtDate(date) : ''
  const noBookings = !loading && !fetchError && roster.length === 0

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Bookings for ${className ?? 'class'} on ${formattedDate}`}
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-[400px] max-w-full flex-col',
          'bg-[var(--bg-app)] border-l border-[var(--border-default)]',
          'shadow-2xl',
          'animate-in slide-in-from-right duration-250',
        ].join(' ')}
      >
        {/* ---- Header ---- */}
        <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)] truncate leading-tight">
              {className ?? 'Class Bookings'}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {formattedDate && (
                <span className="text-xs text-[var(--text-tertiary)]">{formattedDate}</span>
              )}
              {!loading && !fetchError && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                  <Users className="size-3" />
                  {roster.length} booked
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close bookings panel"
            className="ml-auto shrink-0 rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ---- Scrollable body ---- */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
            </div>
          )}

          {/* Fetch error */}
          {!loading && fetchError && (
            <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
              {fetchError}
            </div>
          )}

          {/* Empty state */}
          {noBookings && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[var(--bg-subtle)]">
                <Users className="size-5 text-[var(--text-quaternary)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">No bookings yet for this session.</p>
              <p className="mt-1 text-xs text-[var(--text-quaternary)]">
                Clients can book and pay from their portal.
              </p>
            </div>
          )}

          {/* Roster list */}
          {!loading && !fetchError && roster.length > 0 && (
            <ul className="space-y-2">
              {roster.map((entry) => (
                <RosterRow
                  key={entry.sessionId}
                  entry={entry}
                  onToggle={handleToggleAttendance}
                  patching={patching.has(entry.sessionId)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* ---- Footer: Message all booked ---- */}
        <div className="shrink-0 border-t border-[var(--border-subtle)] px-4 py-3 space-y-3">
          {!msgOpen ? (
            <button
              type="button"
              disabled={roster.length === 0}
              onClick={() => { setMsgOpen(true); setSendResult(null); setSendError(null) }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="size-4" />
              Message all booked
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
                  Message {clientIds.length} {clientIds.length === 1 ? 'client' : 'clients'}
                </p>
                <button
                  type="button"
                  onClick={() => { setMsgOpen(false); setSendResult(null); setSendError(null) }}
                  className="text-[11px] text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
              </div>

              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                rows={3}
                placeholder={`Send a message to everyone booked for ${className ?? 'this class'}…`}
                className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />

              {sendResult === 'sent' && (
                <p className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-[11px] font-medium text-emerald-400">
                  Message sent to {clientIds.length} {clientIds.length === 1 ? 'client' : 'clients'}.
                </p>
              )}

              {sendResult === 'error' && sendError && (
                <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-[11px] text-[var(--error)]">
                  {sendError}
                </p>
              )}

              <button
                type="button"
                disabled={!msgText.trim() || sending || clientIds.length === 0}
                onClick={handleSendMessage}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
