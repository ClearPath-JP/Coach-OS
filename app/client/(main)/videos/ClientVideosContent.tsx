'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, AlertCircle, Play } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

type LibVideo = {
  id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ClientVideosContent() {
  const [videos, setVideos] = useState<LibVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<LibVideo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/videos', { credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as { data?: LibVideo[]; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load videos')
        return
      }
      setVideos(json.data ?? [])
    } catch {
      setError('Network error — please refresh')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Group by category, preserving the server's newest-first order within each group.
  const groups: [string, LibVideo[]][] = (() => {
    const map = new Map<string, LibVideo[]>()
    for (const v of videos) {
      const key = v.category?.trim() || 'Videos'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(v)
    }
    return [...map.entries()]
  })()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">Videos</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Technique videos and lessons your coach has shared.</p>
      </header>

      {loading && (
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading videos...</p>
        </Card>
      )}

      {!loading && error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && videos.length === 0 && (
        <EmptyState title="No videos yet" description="Your coach hasn't shared any videos yet. Check back soon." />
      )}

      {!loading && !error && groups.map(([category, items]) => (
        <section key={category} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">{category}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setPlaying(v)}
                className="group overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-left transition-colors hover:border-[var(--cp-accent)]"
              >
                <div
                  className="relative aspect-video w-full bg-[var(--bg-muted)] bg-cover bg-center"
                  style={v.thumbnail_url ? { backgroundImage: `url(${v.thumbnail_url})` } : undefined}
                >
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                      <Play className="size-4 translate-x-px" fill="currentColor" />
                    </span>
                  </span>
                  {formatDuration(v.duration_seconds) && (
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                      {formatDuration(v.duration_seconds)}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="line-clamp-2 text-[13px] font-medium text-[var(--text-primary)]">{v.title}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {playing && (
        <Modal isOpen onClose={() => setPlaying(null)} title={playing.title} className="w-full max-w-none md:w-[min(96vw,1100px)]">
          <VideoPlayer videoId={playing.id} title={playing.title} thumbnailUrl={playing.thumbnail_url} />
          {playing.description?.trim() && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{playing.description}</p>
          )}
        </Modal>
      )}
    </div>
  )
}
