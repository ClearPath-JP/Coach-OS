import { AbsoluteFill, Audio, OffthreadVideo, Series, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties } from 'react'

export type TimelineRenderClip = {
  mp4Url: string
  inSec: number
  outSec: number
  crop: { x: number; y: number; w: number; h: number } | null
  captionsOn: boolean
  fillMode?: 'color' | 'blur' | 'crop'
}
export type TimelineCaption = { text: string; startMs: number; endMs: number } // timeline-time
export type TimelineAudio = { musicUrl: string | null; voiceoverUrl: string | null; volumes: { clip: number; music: number; voiceover: number } }
export type TimelineVideoProps = {
  clips: TimelineRenderClip[]
  captions: TimelineCaption[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
  audio?: TimelineAudio
}

const FPS = 30
const tiktokStyle: CSSProperties = { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 64, lineHeight: 1.1, color: 'white', textAlign: 'center', WebkitTextStroke: '8px black', paintOrder: 'stroke fill', textShadow: '0 4px 24px rgba(0,0,0,0.5)', maxWidth: '88%' }
const minimalStyle: CSSProperties = { fontWeight: 600, fontSize: 46, lineHeight: 1.2, color: 'white', backgroundColor: 'rgba(0,0,0,0.55)', padding: '12px 24px', borderRadius: 12, maxWidth: '88%' }

function ClipLayer({ clip, volume }: { clip: TimelineRenderClip; volume: number }) {
  const trimBefore = Math.round(clip.inSec * FPS)
  const trimAfter = Math.round(clip.outSec * FPS)
  const mode = clip.fillMode ?? (clip.crop ? 'crop' : 'color')

  if (mode === 'blur') {
    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px) brightness(0.55)', transform: 'scale(1.2)' }} />
        <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </AbsoluteFill>
    )
  }
  if (mode === 'crop') {
    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    )
  }
  // 'color' (default): whole clip centered on black — nothing chopped.
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </AbsoluteFill>
  )
}

function splitWordsLocal(text: string, startMs: number, endMs: number) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [] as { word: string; startMs: number; endMs: number }[]
  const per = Math.max(0, endMs - startMs) / words.length
  return words.map((word, i) => ({ word, startMs: startMs + i * per, endMs: startMs + (i + 1) * per }))
}

function CaptionLayer({ captions, captionStyle }: { captions: TimelineCaption[]; captionStyle: TimelineVideoProps['captionStyle'] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (captionStyle === 'none') return null
  const ms = (frame / fps) * 1000
  const active = captions.find((c) => ms >= c.startMs && ms < c.endMs)
  if (!active) return null
  if (captionStyle === 'karaoke') {
    const words = splitWordsLocal(active.text, active.startMs, active.endMs)
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220 }}>
        <span style={tiktokStyle}>
          {words.map((w, i) => (
            <span key={`${w.startMs}-${w.endMs}-${w.word}-${i}`} style={{ color: ms >= w.startMs && ms < w.endMs ? '#c8882e' : 'white' }}>
              {w.word}{i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </AbsoluteFill>
    )
  }
  const style = captionStyle === 'minimal' ? minimalStyle : tiktokStyle
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220 }}>
      <span style={style}>{active.text}</span>
    </AbsoluteFill>
  )
}

export function TimelineVideo({ clips, captions, captionStyle, audio }: TimelineVideoProps) {
  const vol = audio?.volumes ?? { clip: 1, music: 0.5, voiceover: 1 }
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Series>
        {clips.map((clip, i) => {
          const durationInFrames = Math.max(1, Math.round((clip.outSec - clip.inSec) * FPS))
          return (
            <Series.Sequence key={i} durationInFrames={durationInFrames}>
              <ClipLayer clip={clip} volume={vol.clip} />
            </Series.Sequence>
          )
        })}
      </Series>
      {audio?.musicUrl ? <Audio src={audio.musicUrl} volume={vol.music} /> : null}
      {audio?.voiceoverUrl ? <Audio src={audio.voiceoverUrl} volume={vol.voiceover} /> : null}
      <CaptionLayer captions={captions} captionStyle={captionStyle} />
    </AbsoluteFill>
  )
}
