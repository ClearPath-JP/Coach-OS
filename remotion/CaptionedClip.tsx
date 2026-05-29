import type { CSSProperties } from 'react'
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion'

export type Caption = { text: string; startMs: number; endMs: number }
export type CaptionStyle = 'tiktok' | 'minimal' | 'none'

export type CaptionedClipProps = {
  /** Public MP4 URL (Bunny Stream MP4 fallback) of the source clip. */
  mp4Url: string
  /** Trim window, in seconds of the source video. */
  trimStartSec: number
  trimEndSec: number | null
  /** Caption cues with absolute source timing (from Bunny's Whisper transcript / VTT). */
  captions: Caption[]
  captionStyle: CaptionStyle
}

const tiktokStyle: CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 800,
  fontSize: 64,
  lineHeight: 1.1,
  color: 'white',
  textAlign: 'center',
  WebkitTextStroke: '8px black',
  paintOrder: 'stroke fill',
  textShadow: '0 4px 24px rgba(0,0,0,0.5)',
  maxWidth: '88%',
}

const minimalStyle: CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 600,
  fontSize: 46,
  lineHeight: 1.2,
  color: 'white',
  textAlign: 'center',
  backgroundColor: 'rgba(0,0,0,0.55)',
  padding: '12px 24px',
  borderRadius: 12,
  maxWidth: '88%',
}

/**
 * The render composition: plays the trimmed segment of the source clip and
 * overlays the active caption cue. Phase-2 will swap the simple overlay for
 * @remotion/captions TikTok-style word highlighting.
 */
export const CaptionedClip = ({ mp4Url, trimStartSec, trimEndSec, captions, captionStyle }: CaptionedClipProps) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentSourceMs = (trimStartSec + frame / fps) * 1000
  const active =
    captionStyle === 'none'
      ? null
      : (captions.find((c) => currentSourceMs >= c.startMs && currentSourceMs < c.endMs) ?? null)

  const trimBefore = Math.round(trimStartSec * fps)
  const trimAfter = trimEndSec != null ? Math.round(trimEndSec * fps) : undefined

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {mp4Url ? <OffthreadVideo src={mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} /> : null}
      {active ? (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220 }}>
          <span style={captionStyle === 'tiktok' ? tiktokStyle : minimalStyle}>{active.text}</span>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  )
}
