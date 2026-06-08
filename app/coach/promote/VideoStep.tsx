'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload as TusUpload } from 'tus-js-client'
import { Film, Loader2, Wand2, Upload, CheckCircle2, FileVideo } from 'lucide-react'
import { type PromoteResult, type GenerateResponse, type BrandVoice, type DoneMeta } from './promote-shared'
import { VideoEditor, type Cue } from './VideoEditor'

type LibraryVideo = { id: string; title: string }
type UploadState = 'idle' | 'creating' | 'uploading' | 'processing' | 'ready' | 'failed'

export function VideoStep({
  voice,
  initialVideoId,
  onDone,
}: {
  voice: BrandVoice
  initialVideoId?: string | null
  onDone: (r: PromoteResult, meta?: DoneMeta) => void
}) {
  const [videos, setVideos] = useState<LibraryVideo[]>([])
  const [selectedId, setSelectedId] = useState(initialVideoId ?? '')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadPct, setUploadPct] = useState(0)
  const [embed, setEmbed] = useState<{ libraryId: string; guid: string } | null>(null)
  const [transcript, setTranscript] = useState('')
  const [sourceVideoId, setSourceVideoId] = useState<string | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const [cues, setCues] = useState<Cue[]>([])
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/videos?status=ready', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: unknown } | null) => {
        if (cancelled || !json || !Array.isArray(json.data)) return
        setVideos(
          json.data
            .map((v): LibraryVideo | null => {
              if (!v || typeof v !== 'object') return null
              const o = v as Record<string, unknown>
              const id = typeof o.id === 'string' ? o.id : null
              const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'Untitled video'
              return id ? { id, title } : null
            })
            .filter((v): v is LibraryVideo => v !== null)
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function pollStatus(guid: string) {
    for (let i = 0; i < 90 && !cancelledRef.current; i++) {
      await new Promise((r) => setTimeout(r, 4000))
      if (cancelledRef.current) return
      try {
        const res = await fetch(`/api/coach/promote/bunny/status?guid=${encodeURIComponent(guid)}`, {
          credentials: 'include',
        })
        if (!res.ok) continue
        const d = (await res.json()).data as {
          ready?: boolean
          failed?: boolean
          captionsText?: string
          durationSeconds?: number | null
          cues?: Cue[]
        }
        if (d.failed) {
          setUploadState('failed')
          setError('Bunny could not process this clip. Try a different file.')
          return
        }
        if (d.ready) {
          const text = d.captionsText ?? ''
          setTranscript(text)
          if (text) setDescription((prev) => prev || text.slice(0, 480))
          if (typeof d.durationSeconds === 'number' && d.durationSeconds > 0) setDurationSec(d.durationSeconds)
          if (Array.isArray(d.cues)) setCues(d.cues)
          setUploadState('ready')
          return
        }
      } catch {
        /* keep polling */
      }
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setTranscript('')
    setUploadPct(0)
    setUploadState('creating')
    void fetch('/api/coach/promote/bunny/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: file.name, fileSizeBytes: file.size }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: {
            videoId: string
            libraryId: string
            tusEndpoint: string
            authorizationSignature: string
            authorizationExpire: number
            dbId?: string | null
          }
          error?: string
        }
        if (!res.ok || !json.data) {
          setError(json.error ?? 'Upload could not start')
          setUploadState('failed')
          return
        }
        const { videoId, libraryId, tusEndpoint, authorizationSignature, authorizationExpire } = json.data
        setEmbed({ libraryId: String(libraryId), guid: videoId })
        if (json.data.dbId) setSourceVideoId(json.data.dbId)
        setUploadState('uploading')
        const upload = new TusUpload(file, {
          endpoint: tusEndpoint,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: authorizationSignature,
            AuthorizationExpire: String(authorizationExpire),
            LibraryId: String(libraryId),
            VideoId: videoId,
          },
          metadata: { filetype: file.type || 'video/mp4', title: file.name },
          onError: () => {
            setError('Upload failed — try again')
            setUploadState('failed')
          },
          onProgress: (sent, total) => setUploadPct(total ? Math.round((sent / total) * 100) : 0),
          onSuccess: () => {
            setUploadState('processing')
            void pollStatus(videoId)
          },
        })
        upload.start()
      })
      .catch(() => {
        setError('Upload could not start — try again')
        setUploadState('failed')
      })
  }

  async function plan() {
    setError(null)
    setLoading(true)
    const selectedTitle = videos.find((v) => v.id === selectedId)?.title
    const topic = [description.trim(), selectedTitle ? `(clip: ${selectedTitle})` : '']
      .filter(Boolean)
      .join(' ')
      .slice(0, 500)
    try {
      const res = await fetch('/api/coach/promote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'workout', // unused by video mode; the schema just requires a kind
          mode: 'video',
          tone: voice.tone,
          discipline: voice.discipline || undefined,
          topic: topic || undefined,
          platform: voice.platform,
          bookingUrl: voice.bookingUrl || undefined,
          signature: voice.signature || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as GenerateResponse
      if (!res.ok) {
        setError(json.error ?? 'Could not generate — try again')
        return
      }
      if (json.data?.mode === 'video')
        onDone(
          { type: 'video', videoPlan: json.data.videoPlan },
          { kind: null, sourceVideoId: sourceVideoId ?? (selectedId || null) }
        )
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const uploading = uploadState === 'creating' || uploadState === 'uploading' || uploadState === 'processing'

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
      {/* Upload */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          <Upload className="size-3.5" /> Upload your clip
        </label>

        {uploadState === 'idle' || uploadState === 'failed' ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-7 text-center transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg-muted)]">
            <FileVideo className="size-6 text-[var(--text-tertiary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Choose a video to upload</span>
            <span className="text-[11px] text-[var(--text-quaternary)]">
              Hosted on Bunny + auto-transcribed. The trim + caption editor lands next.
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        ) : null}

        {uploadState === 'creating' && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-tertiary)]">
            <Loader2 className="size-4 animate-spin" /> Starting upload…
          </div>
        )}

        {uploadState === 'uploading' && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 py-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="size-4 animate-spin" /> Uploading… {uploadPct}%
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        )}

        {uploadState === 'processing' && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-tertiary)]">
            <Loader2 className="size-4 animate-spin" /> Transcoding + transcribing on Bunny… (usually 1–3 min)
          </div>
        )}

        {uploadState === 'ready' && embed && (
          <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--success)]">
              <CheckCircle2 className="size-4" /> Uploaded &amp; transcribed
            </p>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={`https://iframe.mediadelivery.net/embed/${embed.libraryId}/${embed.guid}`}
                className="h-full w-full"
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
                allowFullScreen
                title="Uploaded clip"
              />
            </div>
            {transcript && (
              <details className="text-xs text-[var(--text-tertiary)]">
                <summary className="cursor-pointer font-medium text-[var(--text-secondary)]">Transcript</summary>
                <p className="mt-1.5 max-h-32 overflow-y-auto leading-relaxed">{transcript}</p>
              </details>
            )}
            {sourceVideoId && durationSec > 0 ? (
              <VideoEditor sourceVideoId={sourceVideoId} durationSec={durationSec} cues={cues} />
            ) : (
              <p className="text-[11px] text-[var(--text-quaternary)]">
                Get the AI plan below to caption + structure your Reel.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">or describe a clip</span>
        <span className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      {/* Plan (works with or without an upload) */}
      <p className="text-sm text-[var(--text-tertiary)]">
        {transcript ? 'I pre-filled the details from your transcript — tweak it, then plan the Reel.' : 'Or describe a clip and I’ll plan the whole Reel — hook, how to cut it, on-screen text, and the caption.'}
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

      <button
        type="button"
        onClick={plan}
        disabled={loading || uploading}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
        Plan my video
      </button>

      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  )
}
