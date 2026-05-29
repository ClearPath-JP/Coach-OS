'use client'

import { useEffect, useState } from 'react'
import { Film, Loader2, Wand2, Upload } from 'lucide-react'
import { type Tone, type PromoteResult, type GenerateResponse } from './promote-shared'

type LibraryVideo = { id: string; title: string }

export function VideoStep({
  discipline,
  tone,
  onDone,
}: {
  discipline: string
  tone: Tone
  onDone: (r: PromoteResult) => void
}) {
  const [videos, setVideos] = useState<LibraryVideo[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditorNote, setShowEditorNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/videos?status=ready', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: unknown } | null) => {
        if (cancelled || !json || !Array.isArray(json.data)) return
        const rows = json.data
          .map((v): LibraryVideo | null => {
            if (!v || typeof v !== 'object') return null
            const o = v as Record<string, unknown>
            const id = typeof o.id === 'string' ? o.id : null
            const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'Untitled video'
            return id ? { id, title } : null
          })
          .filter((v): v is LibraryVideo => v !== null)
        setVideos(rows)
      })
      .catch(() => {
        /* library is optional */
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function plan() {
    setError(null)
    setLoading(true)
    const selectedTitle = videos.find((v) => v.id === selectedId)?.title
    const topic = [description.trim(), selectedTitle ? `(clip: ${selectedTitle})` : ''].filter(Boolean).join(' ')
    try {
      const res = await fetch('/api/coach/promote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: 'workout', mode: 'video', tone, discipline: discipline || undefined, topic: topic || undefined }),
      })
      const json = (await res.json().catch(() => ({}))) as GenerateResponse
      if (!res.ok) {
        setError(json.error ?? 'Could not generate — try again')
        return
      }
      if (json.data?.mode === 'video') onDone({ type: 'video', videoPlan: json.data.videoPlan })
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
      <p className="text-sm text-[var(--text-tertiary)]">
        Tell me about your clip and I’ll plan the whole Reel — the hook, how to cut it, the on-screen text, and the caption.
      </p>

      {videos.length > 0 && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
            <Film className="size-3.5" /> Pick a clip from your library <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">No clip — I’ll describe it</option>
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          What happens in the clip?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. me drilling an armbar from guard, slow then full speed, then a smiling beginner landing it"
          disabled={loading}
          rows={3}
          maxLength={500}
          className="w-full resize-y rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={plan}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Plan my video
        </button>
        <button
          type="button"
          onClick={() => setShowEditorNote((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
        >
          <Upload className="size-4" />
          Upload &amp; edit a clip
          <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-quaternary)]">Soon</span>
        </button>
      </div>

      {showEditorNote && (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
          The in-app editor — upload, trim, auto-captions, and re-render — is being set up next. For now, pick a library clip
          or describe yours above and I’ll plan the whole Reel for you to shoot and post.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  )
}
