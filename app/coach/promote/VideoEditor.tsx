'use client'

import { useEffect, useRef, useState } from 'react'
import { Scissors, Captions, Loader2, Film, Download, CheckCircle2, Sparkles } from 'lucide-react'

export type Cue = { text: string; startMs: number; endMs: number }
type CaptionStyle = 'tiktok' | 'minimal' | 'none'
type RenderState = 'idle' | 'rendering' | 'done' | 'failed'

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

const STYLES: { key: CaptionStyle; label: string; hint: string }[] = [
  { key: 'tiktok', label: 'TikTok', hint: 'Bold white, heavy outline' },
  { key: 'minimal', label: 'Minimal', hint: 'Clean on a dark bar' },
  { key: 'none', label: 'None', hint: 'No captions' },
]

/**
 * Phase-2 editor: trim the uploaded clip + pick a caption style, render it on
 * Remotion Lambda (burned-in captions), then download the finished vertical clip.
 */
export function VideoEditor({
  sourceVideoId,
  durationSec,
  cues,
}: {
  sourceVideoId: string
  durationSec: number
  cues: Cue[]
}) {
  const hasCaptions = cues.length > 0
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(durationSec)
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(hasCaptions ? 'tiktok' : 'none')

  const [renderState, setRenderState] = useState<RenderState>('idle')
  const [starting, setStarting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const clipLen = Math.max(0, end - start)

  function changeStart(v: number) {
    setStart(Math.min(v, end - 0.5 < 0 ? 0 : end - 0.5))
  }
  function changeEnd(v: number) {
    setEnd(Math.max(v, start + 0.5))
  }

  async function pollRender(editId: string) {
    for (let i = 0; i < 200 && !cancelledRef.current; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      if (cancelledRef.current) return
      try {
        const res = await fetch(`/api/coach/promote/render/status?editId=${encodeURIComponent(editId)}`, {
          credentials: 'include',
        })
        if (!res.ok) continue
        const d = (await res.json()).data as { status: RenderState; progress: number; outputUrl: string | null; error: string | null }
        setProgress(d.progress ?? 0)
        if (d.status === 'done' && d.outputUrl) {
          setOutputUrl(d.outputUrl)
          setRenderState('done')
          return
        }
        if (d.status === 'failed') {
          setError(d.error ?? 'Render failed — try again')
          setRenderState('failed')
          return
        }
      } catch {
        /* keep polling */
      }
    }
  }

  async function startRender() {
    setError(null)
    setProgress(0)
    setOutputUrl(null)
    setStarting(true)
    try {
      const res = await fetch('/api/coach/promote/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceVideoId,
          trimStartSec: Number(start.toFixed(2)),
          trimEndSec: Number(end.toFixed(2)),
          captionStyle,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { data?: { editId: string }; error?: string }
      setStarting(false)
      if (res.status === 503) {
        setError('Rendering isn’t enabled yet — it needs the AWS/Lambda setup. Trim + style are ready the moment it’s wired.')
        return
      }
      if (!res.ok || !json.data?.editId) {
        setRenderState('failed')
        setError(json.error ?? 'Could not start the render')
        return
      }
      setRenderState('rendering')
      void pollRender(json.data.editId)
    } catch {
      setStarting(false)
      setRenderState('failed')
      setError('Network error — please try again')
    }
  }

  const rendering = renderState === 'rendering'

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
        <Sparkles className="size-3.5 text-[var(--accent)]" /> Edit &amp; render
      </p>

      {/* Trim */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
            <Scissors className="size-3.5" /> Trim
          </span>
          <span className="tabular-nums text-[var(--text-tertiary)]">
            {fmt(start)} → {fmt(end)} · <span className="text-[var(--accent)]">{clipLen.toFixed(1)}s</span>
          </span>
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] text-[var(--text-quaternary)]">Start</span>
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.1}
            value={start}
            disabled={rendering}
            onChange={(e) => changeStart(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-[var(--text-quaternary)]">End</span>
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.1}
            value={end}
            disabled={rendering}
            onChange={(e) => changeEnd(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </label>
      </div>

      {/* Caption style */}
      <div className="space-y-1.5">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
          <Captions className="size-3.5" /> Captions
          {!hasCaptions && <span className="text-[11px] font-normal text-[var(--text-quaternary)]">(no speech detected in this clip)</span>}
        </span>
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => {
            const active = captionStyle === s.key
            const disabled = rendering || (s.key !== 'none' && !hasCaptions)
            return (
              <button
                key={s.key}
                type="button"
                disabled={disabled}
                onClick={() => setCaptionStyle(s.key)}
                className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-subtle)] hover:border-[var(--accent)]/50'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{s.label}</span>
                <span className="text-[10px] leading-tight text-[var(--text-quaternary)]">{s.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Render */}
      {renderState !== 'done' && (
        <button
          type="button"
          onClick={startRender}
          disabled={rendering || starting || clipLen < 0.5}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {rendering || starting ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
          {starting ? 'Starting…' : rendering ? `Rendering… ${Math.round(progress * 100)}%` : 'Render captioned clip'}
        </button>
      )}

      {rendering && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {renderState === 'done' && outputUrl && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--success)]">
            <CheckCircle2 className="size-4" /> Rendered
          </p>
          <video src={outputUrl} controls className="aspect-[9/16] max-h-[60vh] w-full rounded-lg bg-black" />
          <a
            href={outputUrl}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]"
          >
            <Download className="size-4" /> Download clip
          </a>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  )
}
