'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Only ever embed Bunny's hosted player — never trust an arbitrary URL in an <iframe src>. */
const BUNNY_EMBED_PREFIX = 'https://iframe.mediadelivery.net/'

export interface VideoPlayerProps {
  videoId: string
  title?: string
  thumbnailUrl?: string | null
  autoPlay?: boolean
  className?: string
}

function VideoPlayerInner({ videoId, title, thumbnailUrl, autoPlay, className }: VideoPlayerProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
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
      } catch {
        // fall through to cookie-only stream
      }
      if (!cancelled) setSrc(`/api/videos/${videoId}/stream`)
    })()
    return () => {
      cancelled = true
    }
  }, [videoId])

  return (
    <div
      className={cn('video-player-wrapper relative w-full overflow-hidden bg-black', className)}
      style={{
        borderRadius: 'var(--radius-lg, 0.75rem)',
        aspectRatio: '16/9',
      }}
    >
      {embedUrl ? (
        // Bunny's hosted player — plays HLS in every browser (native <video> can't).
        <iframe
          src={embedUrl}
          className="h-full w-full"
          allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
          allowFullScreen
          title={title}
        />
      ) : src ? (
        <video
          src={src}
          controls
          preload="metadata"
          poster={thumbnailUrl ?? undefined}
          autoPlay={autoPlay}
          playsInline
          className="h-full w-full object-contain"
          title={title}
          onError={(e) => {
            console.error('Video stream error:', e)
          }}
        >
          Your browser does not support video playback.
        </video>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
          Loading player…
        </div>
      )}
    </div>
  )
}

/**
 * HTML5 video via authenticated stream proxy (Drive or legacy Supabase URL).
 */
export function VideoPlayer(props: VideoPlayerProps) {
  return <VideoPlayerInner key={props.videoId} {...props} />
}
