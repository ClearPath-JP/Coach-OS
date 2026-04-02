'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

export type SessionNotesMessagePayload = {
  sessionId: string
  summary: string
  actionItems: { id: string; text: string }[]
  sessionDate: string
}

export function parseSessionNotesPayload(content: string): SessionNotesMessagePayload | null {
  try {
    const p = JSON.parse(content) as SessionNotesMessagePayload
    if (p && typeof p.sessionId === 'string' && typeof p.summary === 'string' && p.sessionDate) {
      return {
        sessionId: p.sessionId,
        summary: p.summary,
        actionItems: Array.isArray(p.actionItems) ? p.actionItems : [],
        sessionDate: p.sessionDate,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Coach thread: compact recap preview + live client completion counts */
export function CoachSessionNotesMessageCard({
  payload,
  clientName,
  messageCreatedAt,
}: {
  payload: SessionNotesMessagePayload
  clientName: string
  messageCreatedAt: string
}) {
  const [clientDone, setClientDone] = useState<number | null>(null)
  const [clientTotal, setClientTotal] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(payload.sessionId)}/notes`, {
          credentials: 'include',
        })
        const json = (await res.json()) as {
          data?: { session?: { action_items?: unknown } }
        }
        if (cancelled || !res.ok || !json.data?.session) return
        const raw = json.data.session.action_items
        const list = Array.isArray(raw) ? raw : []
        const clientItems = list.filter(
          (i: { assigned_to?: string }) => i?.assigned_to === 'client'
        ) as { completed?: boolean }[]
        setClientTotal(clientItems.length)
        setClientDone(clientItems.filter((i) => i.completed === true).length)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payload.sessionId])

  const preview = payload.summary.trim().slice(0, 50)
  const more = payload.summary.trim().length > 50 ? '…' : ''
  const clientCount = payload.actionItems.length

  return (
    <div className="max-w-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[16px]" aria-hidden>
          📋
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--color-ink)]">
            Session notes sent to {clientName}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--color-muted)]">
            {preview}
            {more}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
            {clientCount} action {clientCount === 1 ? 'item' : 'items'}
            {clientTotal != null && clientTotal > 0 && clientDone != null
              ? ` · ${clientDone} of ${clientTotal} done`
              : ''}
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            Sent {formatDistanceToNow(new Date(messageCreatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  )
}

type LiveActionItem = {
  id: string
  text: string
  completed: boolean
  completedAt: string | null
}

async function fetchClientSessionNotesLive(
  sessionId: string
): Promise<{ sessionSummary: string | null; actionItems: LiveActionItem[] } | null> {
  try {
    const res = await fetch(`/api/client/sessions/${encodeURIComponent(sessionId)}/session-notes`, {
      credentials: 'include',
    })
    const json = (await res.json()) as {
      data?: {
        sessionSummary?: string | null
        actionItems?: LiveActionItem[]
      }
    }
    if (!res.ok || !json.data) return null
    const actionItems = Array.isArray(json.data.actionItems)
      ? json.data.actionItems.map((i) => ({
          id: i.id,
          text: i.text,
          completed: i.completed,
          completedAt: i.completedAt,
        }))
      : []
    return {
      sessionSummary: typeof json.data.sessionSummary === 'string' ? json.data.sessionSummary : null,
      actionItems,
    }
  } catch {
    return null
  }
}

/** Client thread: full recap card with checkboxes */
export function ClientSessionNotesMessageCard({
  payload,
  coachName,
  onActionUpdated,
}: {
  payload: SessionNotesMessagePayload
  coachName: string
  onActionUpdated?: () => void
}) {
  const [summary, setSummary] = useState(payload.summary)
  const [items, setItems] = useState<LiveActionItem[]>(
    payload.actionItems.map((i) => ({
      id: i.id,
      text: i.text,
      completed: false,
      completedAt: null,
    }))
  )
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const data = await fetchClientSessionNotesLive(payload.sessionId)
      if (cancelled) return
      if (data) {
        if (data.sessionSummary != null) {
          setSummary(data.sessionSummary)
        }
        setItems(data.actionItems)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [payload.sessionId])

  const sessionDay = format(new Date(payload.sessionDate), 'MMMM d, yyyy')
  const doneCount = items.filter((i) => i.completed).length
  const total = items.length
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const toggle = async (id: string) => {
    const row = items.find((i) => i.id === id)
    if (!row || row.completed || busyId) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(payload.sessionId)}/action-items/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ actionItemId: id }),
        }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not update')
        return
      }
      const data = await fetchClientSessionNotesLive(payload.sessionId)
      if (data) {
        if (data.sessionSummary != null) {
          setSummary(data.sessionSummary)
        }
        setItems(data.actionItems)
      }
      onActionUpdated?.()
      window.dispatchEvent(new CustomEvent('clearpath:unread-messages-updated'))
    } catch {
      setError('Could not update — try again')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-[min(100%,360px)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-accent-bg)]/40 to-[var(--color-bg)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[18px]"
            aria-hidden
          >
            📋
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[var(--color-ink)]">Session recap from {coachName}</p>
            <p className="text-[13px] text-[var(--color-muted)]">{sessionDay}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            How your session went
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-ink)]">
            {loading ? '…' : summary}
          </p>
        </div>

        {items.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Your action items
            </p>
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={item.completed || busyId !== null}
                    onClick={() => void toggle(item.id)}
                    className={cn(
                      'flex w-full min-h-[44px] items-start gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-left transition-colors',
                      item.completed
                        ? 'bg-[var(--color-surface)] opacity-90'
                        : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)]'
                    )}
                  >
                    <span className="mt-0.5 text-[18px] leading-none text-[var(--color-accent)]" aria-hidden>
                      {item.completed ? '☑' : '☐'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-[15px] text-[var(--color-ink)]',
                          item.completed && 'text-[var(--color-muted)] line-through'
                        )}
                      >
                        {item.text}
                      </span>
                      {item.completed ? (
                        <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-emerald-600">
                          <span aria-hidden>✓</span> Completed
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <p className="text-[12px] text-[var(--color-muted)]">
                {doneCount} of {total} complete
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}
