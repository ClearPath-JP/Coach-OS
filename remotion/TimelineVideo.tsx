import { AbsoluteFill, OffthreadVideo, Series, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties } from 'react'

export type TimelineRenderClip = {
  mp4Url: string
  inSec: number
  outSec: number
  crop: { x: number; y: number; w: number; h: number } | null
  captionsOn: boolean
}
export type TimelineCaption = { text: string; startMs: number; endMs: number } // timeline-time
export type TimelineVideoProps = {
  clips: TimelineRenderClip[]
  captions: TimelineCaption[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
}

const FPS = 30
const tiktokStyle: CSSProperties = { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 64, lineHeight: 1.1, color: 'white', textAlign: 'center', WebkitTextStroke: '8px black', paintOrder: 'stroke fill', textShadow: '0 4px 24px rgba(0,0,0,0.5)', maxWidth: '88%' }
const minimalStyle: CSSProperties = { fontWeight: 600, fontSize: 46, lineHeight: 1.2, color: 'white', backgroundColor: 'rgba(0,0,0,0.55)', padding: '12px 24px', borderRadius: 12, maxWidth: '88%' }

function coverStyle(crop: TimelineRenderClip['crop']): CSSProperties {
  if (!crop) return { width: '100%', height: '100%', objectFit: 'cover' }
  const scale = 1 / Math.max(crop.w || 1, 0.0001)
  const tx = (0.5 - (crop.x + crop.w / 2)) * 100 * scale
  const ty = (0.5 - (crop.y + crop.h / 2)) * 100 * scale
  return { width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty}%)`, transformOrigin: 'center' }
}

function CaptionLayer({ captions, captionStyle }: { captions: TimelineCaption[]; captionStyle: TimelineVideoProps['captionStyle'] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (captionStyle === 'none') return null
  const ms = (frame / fps) * 1000
  const active = captions.find((c) => ms >= c.startMs && ms < c.endMs)
  if (!active) return null
  // Phase 1: 'karaoke' falls back to the tiktok look (true word-by-word lands in Phase 3).
  const style = captionStyle === 'minimal' ? minimalStyle : tiktokStyle
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220 }}>
      <span style={style}>{active.text}</span>
    </AbsoluteFill>
  )
}

export function TimelineVideo({ clips, captions, captionStyle }: TimelineVideoProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Series>
        {clips.map((clip, i) => {
          const durationInFrames = Math.max(1, Math.round((clip.outSec - clip.inSec) * FPS))
          return (
            <Series.Sequence key={i} durationInFrames={durationInFrames}>
              <AbsoluteFill>
                <OffthreadVideo
                  src={clip.mp4Url}
                  trimBefore={Math.round(clip.inSec * FPS)}
                  trimAfter={Math.round(clip.outSec * FPS)}
                  style={coverStyle(clip.crop)}
                />
              </AbsoluteFill>
            </Series.Sequence>
          )
        })}
      </Series>
      <CaptionLayer captions={captions} captionStyle={captionStyle} />
    </AbsoluteFill>
  )
}
