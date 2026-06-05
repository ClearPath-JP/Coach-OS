import { z } from 'zod'

export const FPS = 30
export const FRAME_W = 1080
export const FRAME_H = 1920
export const MAX_CLIPS = 8
export const MAX_TOTAL_SEC = 90

export const CropSchema = z.object({
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  w: z.number().min(0).max(1), h: z.number().min(0).max(1),
})
export type Crop = z.infer<typeof CropSchema>

export const TimelineClipSchema = z.object({
  sourceVideoId: z.string().uuid(),
  inSec: z.number().min(0).default(0),
  outSec: z.number().positive(),
  crop: CropSchema.nullable().default(null),
  captionsOn: z.boolean().default(true),
}).refine((c) => c.outSec > c.inSec, { message: 'Clip end must be after its start' })
export type TimelineClip = z.infer<typeof TimelineClipSchema>

export const TimelineSchema = z.array(TimelineClipSchema).max(MAX_CLIPS)
export type Timeline = z.infer<typeof TimelineSchema>

export const ProjectAudioSchema = z.object({
  musicAssetId: z.string().uuid().nullable().default(null),
  voiceoverAssetId: z.string().uuid().nullable().default(null),
  volumes: z.object({
    clip: z.number().min(0).max(1).default(1),
    music: z.number().min(0).max(1).default(0.5),
    voiceover: z.number().min(0).max(1).default(1),
  }).default({ clip: 1, music: 0.5, voiceover: 1 }),
}).default(() => ({ musicAssetId: null, voiceoverAssetId: null, volumes: { clip: 1, music: 0.5, voiceover: 1 } }))
export type ProjectAudio = z.infer<typeof ProjectAudioSchema>

export const CAPTION_STYLES = ['tiktok', 'minimal', 'karaoke', 'none'] as const
export type CaptionStyle = (typeof CAPTION_STYLES)[number]

export function clipLenSec(c: Pick<TimelineClip, 'inSec' | 'outSec'>): number {
  return Math.max(0, c.outSec - c.inSec)
}
export function totalDurationSec(tl: Pick<TimelineClip, 'inSec' | 'outSec'>[]): number {
  return Number(tl.reduce((s, c) => s + clipLenSec(c), 0).toFixed(3))
}
export function clipFrameRanges(tl: Pick<TimelineClip, 'inSec' | 'outSec'>[]): { fromFrame: number; durationInFrames: number }[] {
  let cursor = 0
  return tl.map((c) => {
    const durationInFrames = Math.round(clipLenSec(c) * FPS)
    const range = { fromFrame: cursor, durationInFrames }
    cursor += durationInFrames
    return range
  })
}
export function totalFrames(tl: Pick<TimelineClip, 'inSec' | 'outSec'>[]): number {
  return Math.max(1, clipFrameRanges(tl).reduce((s, r) => s + r.durationInFrames, 0))
}
