'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScheduleForm } from './ScheduleForm'

type Post = {
  id: string
  platforms: string[]
  caption: string
  scheduled_at: string
  status: string
}

function formatScheduledAt(raw: string): string {
  const d = new Date(raw)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function ScheduledContent() {
  const videoParam = useSearchParams().get('video')

  const [posts, setPosts] = useState<Post[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [canceling, setCanceling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Auto-open form when a ?video= deep-link is present
  useEffect(() => {
    if (videoParam) setShowForm(true)
  }, [videoParam])

  // Silent reload — no full loading spinner; used after mutations
  const reload = useCallback(async () => {
    const res = await fetch('/api/studio/scheduled', { credentials: 'include' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? 'Could not load scheduled posts')
      return
    }
    setPosts((j as { data?: Post[] }).data ?? [])
  }, [])

  // Initial load — shows spinner until data arrives
  const load = useCallback(async () => {
    setLoading(true)
    await reload()
    setLoading(false)
  }, [reload])

  useEffect(() => { void load() }, [load])

  async function cancel(id: string) {
    if (!id) return
    setCanceling(id)
    const res = await fetch(`/api/studio/scheduled/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'canceled' }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? 'Could not cancel post')
    } else {
      void reload()
    }
    setCanceling(null)
  }

  async function remove(id: string) {
    if (!id) return
    setDeleting(id)
    const res = await fetch(`/api/studio/scheduled/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? 'Could not delete post')
    } else {
      void reload()
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          Posts are saved here. Automatic sending turns on once the scheduler is configured.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary-gloss inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
        >
          {showForm ? 'Cancel' : 'Schedule a post'}
        </button>
      </div>

      {showForm && (
        <ScheduleForm
          {...(videoParam ? { defaultVideoId: videoParam } : {})}
          onCreated={() => { void reload(); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {err && <p className="text-sm text-red-400">{err}</p>}

      {loading && (
        <p className="py-10 text-center text-sm text-[var(--text-tertiary)]">Loading…</p>
      )}

      {!loading && posts && posts.length === 0 && (
        <EmptyState
          title="No scheduled posts yet"
          description="No scheduled posts yet."
        />
      )}

      {!loading && (
        <div className="space-y-3">
          {(posts ?? []).map((p) => (
            <Card key={p.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {p.caption.slice(0, 80)}{p.caption.length > 80 ? '…' : ''}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {p.platforms.join(' · ')}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {formatScheduledAt(p.scheduled_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                  {p.status}
                </span>
                {p.status === 'scheduled' && (
                  <button
                    onClick={() => cancel(p.id)}
                    disabled={canceling === p.id}
                    className="text-xs text-[var(--text-tertiary)] transition-opacity hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    {canceling === p.id ? 'Canceling…' : 'Cancel'}
                  </button>
                )}
                <button
                  onClick={() => remove(p.id)}
                  disabled={deleting === p.id}
                  className="text-xs text-[var(--text-tertiary)] transition-opacity hover:text-[var(--text-primary)] disabled:opacity-50"
                >
                  {deleting === p.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
