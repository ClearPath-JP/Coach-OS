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

export const FILL_MODES = ['color', 'blur', 'crop'] as const
export type FillMode = (typeof FILL_MODES)[number]
export const FillModeSchema = z.enum(FILL_MODES)

export const TimelineClipSchema = z.object({
  sourceVideoId: z.string().uuid(),
  inSec: z.number().min(0).default(0),
  outSec: z.number().positive(),
  crop: CropSchema.nullable().default(null),
  // Optional (intentionally not defaulted): absent → effectiveFillMode() applies the
  // back-compat default (legacy clips with a crop → 'crop'; otherwise → 'color').
  fillMode: FillModeSchema.optional(),
  captionsOn: z.boolean().default(true),
}).refine((c) => c.outSec > c.inSec, { message: 'Clip end must be after its start' })
export type TimelineClip = z.infer<typeof TimelineClipSchema>

export const TimelineSchema = z.array(TimelineClipSchema).max(MAX_CLIPS)
export type Timeline = z.infer<typeof TimelineSchema>

export const ProjectAudioSchema = z.object({
  music: z.string().max(300).nullable().default(null),       // storage path in studio-audio, workspace-prefixed
  voiceover: z.string().max(300).nullable().default(null),   // storage path
  volumes: z.object({
    clip: z.number().min(0).max(1).default(1),
    music: z.number().min(0).max(1).default(0.5),
    voiceover: z.number().min(0).max(1).default(1),
  }).default({ clip: 1, music: 0.5, voiceover: 1 }),
}).default(() => ({ music: null, voiceover: null, volumes: { clip: 1, music: 0.5, voiceover: 1 } }))
export type ProjectAudio = z.infer<typeof ProjectAudioSchema>

// Tenant guard: only return a path that belongs to this workspace (paths are `${workspaceId}/...`).
// We also reject any path containing '..' to prevent traversal-style strings, even though
// Supabase Storage treats paths as literal keys (not filesystem paths).
export function audioPublicPath(workspaceId: string, path: string | null): string | null {
  if (!path) return null
  if (path.includes('..')) return null
  return path.startsWith(`${workspaceId}/`) ? path : null
}
export const STUDIO_AUDIO_BUCKET = 'studio-audio'

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

export function effectiveFillMode(c: { fillMode?: FillMode | null; crop?: Crop | null }): FillMode {
  if (c.fillMode != null) return c.fillMode
  return c.crop ? 'crop' : 'color'
}
