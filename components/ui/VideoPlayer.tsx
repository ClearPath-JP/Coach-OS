'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Only ever embed Bunny's hosted player — never trust an arbitrary URL in an <iframe src>. */
const BUNNY_EMBED_PREFIX = 'https://iframe.mediadelivery.net/'
/** Never let the player hang forever — if nothing has loaded by now, show a retry. */
const LOAD_TIMEOUT_MS = 15000

export interface VideoPlayerProps {
  videoId: string
  title?: string
  thumbnailUrl?: string | null
  autoPlay?: boolean
  className?: string
}

type Phase = 'loading' | 'ready' | 'error'

function VideoPlayerInner({ videoId, title, thumbnailUrl, autoPlay, className }: VideoPlayerProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  // Bumping the nonce re-runs the token fetch and remounts the iframe/video (used by "Try again").
  const [nonce, setNonce] = useState(0)

  const retry = useCallback(() => {
    setSrc(null)
    setEmbedUrl(null)
    setPhase('loading')
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Safety net: a hung token fetch or a Bunny outage must surface as an error, not an
    // endless "Loading…" spinner or a silent black box.
    const timeout = setTimeout(() => {
      if (!cancelled) setPhase((p) => (p === 'loading' ? 'error' : p))
    }, LOAD_TIMEOUT_MS)

    void (async () => {
      try {
        const r = await fetch(`/api/videos/${videoId}/token`, {
          method: 'POST',
          credentials: 'include',
        })
        const j = (await r.json()) as { data?: { streamUrl?: string; embedUrl?: string | null } }
        if (cancelled) return
        if (r.ok && j.data?.embedUrl && j.data.embedUrl.startsWith(BUNNY_EMBED_PREFIX)) {
          // Bunny-hosted (HLS): a native <video> can't play it — use the iframe player.
          // Allowlist-checked here so the <iframe src> below can only ever be a Bunny URL.
          setEmbedUrl(j.data.embedUrl)
          return
        }
        if (r.ok && j.data?.streamUrl) {
          setSrc(j.data.streamUrl)
          return
        }
        // Token endpoint responded but gave us nothing usable — try the cookie-auth stream.
      } catch {
        // network error — fall through to cookie-only stream
      }
      if (!cancelled) setSrc(`/api/videos/${videoId}/stream`)
    })()

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [videoId, nonce])

  const isError = phase === 'error'

  return (
    <div
      className={cn('video-player-wrapper relative w-full overflow-hidden bg-black', className)}
      style={{
        borderRadius: 'var(--radius-lg, 0.75rem)',
        aspectRatio: '16/9',
      }}
    >
      {embedUrl && !isError ? (
        // Bunny's hosted player — plays HLS in every browser (native <video> can't).
        <iframe
          key={nonce}
          src={embedUrl}
          className="h-full w-full"
          allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
          allowFullScreen
          title={title}
          onLoad={() => setPhase('ready')}
        />
      ) : src && !isError ? (
        <video
          key={nonce}
          src={src}
          controls
          preload="metadata"
          poster={thumbnailUrl ?? undefined}
          autoPlay={autoPlay}
          playsInline
          className="h-full w-full object-contain"
          title={title}
          onCanPlay={() => setPhase('ready')}
          onError={() => setPhase('error')}
        >
          Your browser does not support video playback.
        </video>
      ) : null}

      {phase === 'loading' && !isError ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Loading player…
        </div>
      ) : null}

      {isError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/85 px-6 text-center">
          <p className="text-sm font-semibold text-white">This video can’t play right now.</p>
          <p className="text-xs text-white/60">It may still be processing, or the connection dropped.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-1 rounded-lg border border-white/30 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Authenticated video player. Bunny-hosted videos use the Bunny iframe; Drive/legacy
 * Supabase videos stream via the authenticated proxy. Always surfaces a retry
 * fallback instead of failing to a silent black box.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  return <VideoPlayerInner key={props.videoId} {...props} />
}
