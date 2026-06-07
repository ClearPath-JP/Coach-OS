'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { RenderPanel } from './RenderPanel'
import { AudioPanel } from './AudioPanel'
import { CropBox } from './CropBox'
import { totalDurationSec, totalFrames, MAX_CLIPS, MAX_TOTAL_SEC, type CaptionStyle, type Crop, ProjectAudioSchema, type ProjectAudio, effectiveFillMode } from '@/lib/studio/timeline'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/icons/inked'
import type { TimelineVideoProps } from '@/remotion/TimelineVideo'

// @remotion/player is browser-only — load it without SSR so `next build` never
// tries to prerender the <Player> on the server.
const LivePreview = dynamic(() => import('./LivePreview').then((m) => m.LivePreview), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[9/16] w-full max-w-[280px] items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-sm text-[var(--text-quaternary)]">
      Loading preview…
    </div>
  ),
})

type LibVideo = { id: string; title: string; thumbnail_url: string | null; mp4_url: string | null; duration_seconds: number | null; embed_url?: string | null }
type EditorClip = { uid: string; sourceVideoId: string; title: string; thumb: string | null; sourceDur: number; inSec: number; outSec: number; captionsOn: boolean; crop: Crop | null }

let _uid = 0
const nextUid = () => `c${++_uid}`

const CAPTION_PICKS: { key: CaptionStyle; label: string; hint: string }[] = [
  { key: 'karaoke', label: 'Karaoke', hint: 'Word-by-word highlight' },
  { key: 'tiktok', label: 'Bold', hint: 'White, heavy outline' },
  { key: 'minimal', label: 'Minimal', hint: 'Clean on a bar' },
  { key: 'none', label: 'Off', hint: 'No captions' },
]

export function StudioEditor({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('Untitled')
  const [clips, setClips] = useState<EditorClip[]>([])
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('tiktok')
  const [selected, setSelected] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibVideo[]>([])
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef<string>('')

  const [audio, setAudio] = useState<ProjectAudio>(() => ProjectAudioSchema.parse({}))
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [pRes, vRes] = await Promise.all([
          fetch(`/api/studio/projects/${projectId}`, { credentials: 'include' }),
          fetch('/api/videos?status=ready', { credentials: 'include' }),
        ])
        const p = pRes.ok ? (await pRes.json().catch(() => ({}))).data : null
        const vids: LibVideo[] = vRes.ok ? ((await vRes.json().catch(() => ({}))).data ?? []) : []
        if (cancelled) return
        setLibrary(vids.filter((v) => v.mp4_url))
        if (!p) {
          setLoadError('We couldn’t load this project. Refresh to try again.')
          return
        }
        setTitle(p.title ?? 'Untitled'); setCaptionStyle(p.caption_style ?? 'tiktok')
        if (p.audio) setAudio(ProjectAudioSchema.parse(p.audio))
        const byId = new Map(vids.map((v) => [v.id, v]))
        setClips((p.timeline ?? []).map((c: { sourceVideoId: string; inSec: number; outSec: number; captionsOn?: boolean; crop?: Crop | null }) => {
          const v = byId.get(c.sourceVideoId)
          return { uid: nextUid(), sourceVideoId: c.sourceVideoId, title: v?.title ?? 'Clip', thumb: v?.thumbnail_url ?? null, sourceDur: v?.duration_seconds ?? c.outSec, inSec: c.inSec, outSec: c.outSec, captionsOn: c.captionsOn ?? true, crop: c.crop ?? null }
        }))
      } catch {
        if (!cancelled) setLoadError('We couldn’t load this project. Check your connection and refresh.')
      }
    })()
    return () => { cancelled = true }
  }, [projectId])

  const addClip = (v: LibVideo) => {
    if (clips.length >= MAX_CLIPS) return
    setClips((cs) => [...cs, { uid: nextUid(), sourceVideoId: v.id, title: v.title, thumb: v.thumbnail_url, sourceDur: v.duration_seconds ?? 10, inSec: 0, outSec: v.duration_seconds ?? 10, captionsOn: true, crop: null }])
    setPicking(false)
  }
  const removeClip = (uid: string) => {
    setClips((cs) => cs.filter((c) => c.uid !== uid))
    setSelected((s) => (s === uid ? null : s))
  }
  const move = (uid: string, dir: -1 | 1) => setClips((cs) => {
    const i = cs.findIndex((c) => c.uid === uid); const j = i + dir
    if (i < 0 || j < 0 || j >= cs.length) return cs
    const copy = [...cs]
    const a = copy[i]!; const b = copy[j]!
    copy[i] = b; copy[j] = a
    return copy
  })
  const trim = (uid: string, inSec: number, outSec: number) => setClips((cs) => cs.map((c) => c.uid === uid ? { ...c, inSec: Math.max(0, Math.min(inSec, c.sourceDur - 0.5)), outSec: Math.min(c.sourceDur, Math.max(outSec, inSec + 0.5)) } : c))
  const toggleCaptions = (uid: string) => setClips((cs) => cs.map((c) => c.uid === uid ? { ...c, captionsOn: !c.captionsOn } : c))
  const setCrop = (uid: string, crop: Crop | null) => setClips((cs) => cs.map((c) => c.uid === uid ? { ...c, crop } : c))
  const split = (uid: string, atSec: number) => {
    const i = clips.findIndex((c) => c.uid === uid); if (i < 0) return
    const c = clips[i]!
    if (atSec <= c.inSec + 0.25 || atSec >= c.outSec - 0.25) return
    const leftUid = nextUid()
    const left = { ...c, uid: leftUid, outSec: atSec }
    const right = { ...c, uid: nextUid(), inSec: atSec }
    setClips([...clips.slice(0, i), left, right, ...clips.slice(i + 1)])
    setSelected(leftUid)
  }

  const serialize = useCallback(() => clips.map((c) => ({ sourceVideoId: c.sourceVideoId, inSec: Number(c.inSec.toFixed(2)), outSec: Number(c.outSec.toFixed(2)), crop: c.crop, captionsOn: c.captionsOn })), [clips])
  const save = useCallback(async () => {
    const body = JSON.stringify({ title, timeline: serialize(), captionStyle, audio })
    if (body === savedRef.current) return
    setSaving(true)
    try {
      const res = await fetch(`/api/studio/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body })
      if (res.ok) savedRef.current = body
    } catch {
      // transient network error — leave savedRef untouched so the next autosave retries
    } finally {
      setSaving(false)
    }
  }, [title, serialize, captionStyle, audio, projectId])
  useEffect(() => { const t = setTimeout(() => { void save() }, 1200); return () => clearTimeout(t) }, [save])

  const selectedClip = clips.find((c) => c.uid === selected) ?? null
  const totalSec = totalDurationSec(serialize())

  // Live composite preview — the same TimelineVideo the Lambda renders, played client-side.
  // Captions are intentionally omitted here (verified at render); audio uses the public
  // studio-audio bucket URL.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const audioUrl = (p: string | null) => (p && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/studio-audio/${p}` : null)
  const previewProps: TimelineVideoProps = {
    clips: clips
      .map((c) => {
        const v = library.find((l) => l.id === c.sourceVideoId)
        return { mp4Url: v?.mp4_url ?? '', inSec: c.inSec, outSec: c.outSec, crop: c.crop, captionsOn: c.captionsOn, fillMode: effectiveFillMode({ fillMode: null, crop: c.crop }) }
      })
      .filter((c) => c.mp4Url),
    captions: [],
    captionStyle,
    audio: {
      musicUrl: audioUrl(audio.music),
      voiceoverUrl: audioUrl(audio.voiceover),
      volumes: audio.volumes,
    },
  }
  const previewFrames = totalFrames(serialize())

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      {/* 1 — Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--accent)]">
            <Icon name="studio" size={18} />
          </span>
          <div className="min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Project title"
              placeholder="Untitled"
              className="w-full max-w-xs truncate rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold tracking-[-0.01em] text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-subtle)] focus:border-[var(--accent)] focus:bg-[var(--bg-app)]"
            />
            <p className="px-1 text-xs text-[var(--text-quaternary)]">{saving ? 'Saving…' : 'Saved'}</p>
          </div>
        </div>
        <RenderPanel projectId={projectId} canRender={clips.length > 0 && totalDurationSec(serialize()) <= MAX_TOTAL_SEC} onBeforeRender={save} title={title} />
      </header>

      {loadError && (
        <p role="alert" className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {loadError}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* LEFT — preview + timeline */}
        <div className="space-y-5">
          {/* 2 — Preview (live composite — clips + trim + crop + audio, played client-side) */}
          <Card padding="default" className="flex flex-col items-center gap-2">
            <LivePreview inputProps={previewProps} durationInFrames={previewFrames} />
            <p className="text-center text-[11px] leading-tight text-[var(--text-quaternary)]">
              Live preview · captions show in the final render
            </p>
          </Card>

          {/* 3 — Timeline */}
          <Card padding="default" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Timeline</h2>
              <span className="tabular-nums text-xs text-[var(--text-tertiary)]">
                Total: <span className="text-[var(--text-secondary)]">{totalSec.toFixed(1)}s</span>
              </span>
            </div>

            {clips.length === 0 ? (
              <EmptyState
                icon={<Icon name="videos" size={40} className="text-[var(--text-quaternary)]" />}
                title="No clips yet"
                description="Add a clip from your library to start building your reel."
                action={
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="btn-primary-gloss inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm"
                  >
                    <span aria-hidden>+</span> Add clip
                  </button>
                }
              />
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {clips.map((c) => {
                    const active = c.uid === selected
                    return (
                      <div
                        key={c.uid}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(c.uid)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(c.uid) } }}
                        className={`group relative w-28 shrink-0 cursor-pointer rounded-xl border p-1.5 transition-colors ${
                          active ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border-default)] bg-[var(--bg-subtle)] hover:border-[var(--accent)]/50'
                        }`}
                      >
                        <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                          {c.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.thumb} alt={c.title} className="size-full object-cover" />
                          ) : (
                            <div className="grid size-full place-items-center text-[var(--text-quaternary)]">
                              <Icon name="videos" size={20} />
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                            {(c.outSec - c.inSec).toFixed(1)}s
                          </span>
                          <button
                            type="button"
                            aria-label="Remove clip"
                            onClick={(e) => { e.stopPropagation(); removeClip(c.uid) }}
                            className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-xs text-white transition-colors hover:bg-[var(--error)]"
                          >
                            ×
                          </button>
                        </div>
                        <p className="mt-1 truncate px-0.5 text-[11px] text-[var(--text-secondary)]">{c.title}</p>
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <button
                            type="button"
                            aria-label="Move left"
                            onClick={(e) => { e.stopPropagation(); move(c.uid, -1) }}
                            className="grid size-6 place-items-center rounded-md border border-[var(--border-default)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            aria-label="Move right"
                            onClick={(e) => { e.stopPropagation(); move(c.uid, 1) }}
                            className="grid size-6 place-items-center rounded-md border border-[var(--border-default)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* + Add clip */}
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    disabled={clips.length >= MAX_CLIPS}
                    className="grid w-28 shrink-0 place-items-center gap-1 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] text-sm text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="text-xl leading-none" aria-hidden>+</span>
                    <span className="text-xs">Add clip</span>
                  </button>
                </div>

                {totalSec > 60 && (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                    Reels under 60s tend to perform better.
                  </p>
                )}
                {totalSec > MAX_TOTAL_SEC && (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    Over the {MAX_TOTAL_SEC}s limit — trim a clip to render.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        {/* RIGHT — inspector + caption style */}
        <div className="space-y-5">
          {/* 4 — Inspector */}
          {selectedClip && (
            <Card padding="default" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="truncate text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Clip</h2>
                <span className="tabular-nums text-xs text-[var(--text-tertiary)]">
                  {(selectedClip.outSec - selectedClip.inSec).toFixed(1)}s
                </span>
              </div>

              {/* Trim sliders */}
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-[11px] text-[var(--text-quaternary)]">
                    <span>Start</span>
                    <span className="tabular-nums">{selectedClip.inSec.toFixed(1)}s</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={selectedClip.sourceDur}
                    step={0.1}
                    value={selectedClip.inSec}
                    onChange={(e) => trim(selectedClip.uid, parseFloat(e.target.value), selectedClip.outSec)}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-[11px] text-[var(--text-quaternary)]">
                    <span>End</span>
                    <span className="tabular-nums">{selectedClip.outSec.toFixed(1)}s</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={selectedClip.sourceDur}
                    step={0.1}
                    value={selectedClip.outSec}
                    onChange={(e) => trim(selectedClip.uid, selectedClip.inSec, parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => split(selectedClip.uid, (selectedClip.inSec + selectedClip.outSec) / 2)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]"
                >
                  Split at midpoint
                </button>
                <button
                  type="button"
                  onClick={() => toggleCaptions(selectedClip.uid)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    selectedClip.captionsOn
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  Captions: {selectedClip.captionsOn ? 'On' : 'Off'}
                </button>
              </div>

              {/* Reframe — pick which part of the source fills the 9:16 frame */}
              <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Reframe</h3>
                  <span className="text-[10px] text-[var(--text-quaternary)]">{selectedClip.crop ? 'Custom' : 'Centered'}</span>
                </div>
                <p className="text-[11px] leading-tight text-[var(--text-quaternary)]">
                  Drag the box to choose what fills the vertical frame.
                </p>
                <CropBox
                  thumbUrl={selectedClip.thumb}
                  crop={selectedClip.crop}
                  onChange={(cr) => setCrop(selectedClip.uid, cr)}
                />
              </div>
            </Card>
          )}

          {/* 5 — Caption style picker */}
          <Card padding="default" className="space-y-2.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Caption style</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CAPTION_PICKS.map((s) => {
                const active = captionStyle === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setCaptionStyle(s.key)}
                    className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border-default)] bg-[var(--bg-subtle)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{s.label}</span>
                    <span className="text-[10px] leading-tight text-[var(--text-quaternary)]">{s.hint}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* 6 — Audio panel */}
          <AudioPanel audio={audio} onChange={setAudio} />
        </div>
      </div>

      {/* 6 — Clip-picker drawer */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setPicking(false)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Add a clip</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPicking(false)}
                className="grid size-8 place-items-center rounded-lg border border-[var(--border-default)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>

            {clips.length >= MAX_CLIPS && (
              <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                You’ve hit the {MAX_CLIPS}-clip limit. Remove a clip to add another.
              </p>
            )}

            {library.length === 0 ? (
              <EmptyState
                icon={<Icon name="videos" size={40} className="text-[var(--text-quaternary)]" />}
                title="No renderable videos"
                description="Upload a video to your library first — only processed Bunny clips can be added here."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {library.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => addClip(v)}
                    disabled={clips.length >= MAX_CLIPS}
                    className="group overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] text-left transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="relative aspect-[9/16] bg-[var(--bg-muted)]">
                      {v.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnail_url} alt={v.title} className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center text-[var(--text-quaternary)]">
                          <Icon name="videos" size={22} />
                        </div>
                      )}
                    </div>
                    <p className="truncate px-2 py-1.5 text-xs text-[var(--text-secondary)]">{v.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
