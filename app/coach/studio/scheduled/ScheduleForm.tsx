'use client'

import { useEffect, useState } from 'react'
import { PLATFORMS } from '@/lib/studio/scheduled'

type VideoOption = {
  id: string
  title: string
  mp4_url: string
}

type Props = {
  defaultVideoId?: string
  onCreated: () => void
  onCancel: () => void
}

export function ScheduleForm({ defaultVideoId, onCreated, onCancel }: Props) {
  const [videos, setVideos] = useState<VideoOption[]>([])
  const [videosLoading, setVideosLoading] = useState(true)

  const [videoId, setVideoId] = useState(defaultVideoId ?? '')
  const [datetime, setDatetime] = useState('')
  const [platforms, setPlatforms] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState('')

  const [drafting, setDrafting] = useState(false)
  const [draftErr, setDraftErr] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load ready videos on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/videos?status=ready', { credentials: 'include' })
        const j = await res.json().catch(() => ({}))
        const raw: Array<{ id: string; title: string; mp4_url?: string | null }> =
          (j as { data?: Array<{ id: string; title: string; mp4_url?: string | null }> }).data ?? []
        const opts = raw.filter((v) => !!v.mp4_url) as VideoOption[]
        setVideos(opts)
        // If no defaultVideoId provided, default to first available video
        if (!defaultVideoId && opts.length > 0 && opts[0]) {
          setVideoId(opts[0].id)
        } else if (defaultVideoId) {
          // Keep the defaultVideoId — it will be valid once list loads
          setVideoId(defaultVideoId)
        }
      } catch {
        // Non-fatal — user can still see empty select
      } finally {
        setVideosLoading(false)
      }
    })()
  }, [defaultVideoId])

  function togglePlatform(p: string) {
    setPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function draftWithAI() {
    setDraftErr(null)
    setDrafting(true)
    try {
      const selectedVideo = videos.find((v) => v.id === videoId)
      const firstPlatform = platforms.size > 0 ? [...platforms][0] : 'instagram'
      const topic = selectedVideo?.title ?? 'my coaching'

      const res = await fetch('/api/coach/promote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: 'bts', mode: 'post', platform: firstPlatform, topic }),
      }).catch(() => null)

      if (!res || !res.ok) {
        setDraftErr('Could not generate caption — try again')
        return
      }

      const j = await res.json().catch(() => ({}))
      const post = (j as { data?: { mode: string; post?: { hook?: string; caption?: string; hashtags?: string[]; cta?: string } } }).data?.post
      if (!post) {
        setDraftErr('Unexpected response from AI')
        return
      }

      const tags =
        post.hashtags && post.hashtags.length > 0
          ? '\n\n' + post.hashtags.map((h: string) => '#' + h).join(' ')
          : ''
      setCaption((post.caption ?? '') + tags)
    } catch {
      setDraftErr('Could not generate caption — try again')
    } finally {
      setDrafting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitErr(null)

    if (!videoId) { setSubmitErr('Select a video'); return }
    if (platforms.size === 0) { setSubmitErr('Select at least one platform'); return }
    if (!datetime) { setSubmitErr('Choose a date and time'); return }

    const scheduledAt = new Date(datetime).toISOString()

    setSubmitting(true)
    try {
      const res = await fetch('/api/studio/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoId, platforms: [...platforms], caption, scheduledAt }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitErr((j as { error?: string }).error ?? 'Could not schedule post')
        return
      }
      onCreated()
    } catch {
      setSubmitErr('Network error — could not schedule post')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !!videoId && platforms.size > 0 && !!datetime && !submitting

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-white/15 bg-[var(--bg-subtle)] p-4 text-sm"
    >
      {/* Video select */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[var(--text-tertiary)]">Video</label>
        {videosLoading ? (
          <p className="text-xs text-[var(--text-tertiary)]">Loading videos…</p>
        ) : videos.length === 0 ? (
          <p className="text-xs text-red-400">No ready videos found — render and save one first.</p>
        ) : (
          <select
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {videos.map((v) => (
              <option key={v.id} value={v.id} className="bg-[var(--bg-base)] text-[var(--text-primary)]">
                {v.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* When */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[var(--text-tertiary)]">When</label>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          required
          className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Platforms */}
      <div className="space-y-1">
        <span className="block text-xs font-medium text-[var(--text-tertiary)]">Platforms</span>
        <div className="flex flex-wrap gap-3">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={platforms.has(p)}
                onChange={() => togglePlatform(p)}
                className="rounded accent-[var(--accent)]"
              />
              <span className="capitalize text-[var(--text-primary)]">{p}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Caption + AI draft */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-[var(--text-tertiary)]">Caption</label>
          <button
            type="button"
            onClick={draftWithAI}
            disabled={drafting || videosLoading || videos.length === 0}
            className="rounded-lg border border-white/15 px-2.5 py-1 text-xs transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {drafting ? 'Drafting…' : 'Draft with AI'}
          </button>
        </div>
        {draftErr && <p className="text-xs text-red-400">{draftErr}</p>}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          placeholder="Write a caption, or use Draft with AI…"
          className="w-full resize-none rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {submitErr && <p className="text-sm text-red-400">{submitErr}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary-gloss inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
        >
          {submitting ? 'Scheduling…' : 'Schedule post'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-[var(--text-tertiary)] transition-opacity hover:opacity-80"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
