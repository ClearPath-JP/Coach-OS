import { z } from 'zod'

export const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const
export type Platform = (typeof PLATFORMS)[number]

export const CreateScheduleSchema = z
  .object({
    videoId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    platforms: z.array(z.enum(PLATFORMS)).min(1).max(4),
    caption: z.string().max(2200).default(''),
    scheduledAt: z.string().datetime(),
  })
  .refine((o) => new Date(o.scheduledAt).getTime() > Date.now(), {
    message: 'scheduledAt must be in the future',
    path: ['scheduledAt'],
  })

export const PatchScheduleSchema = z
  .object({
    platforms: z.array(z.enum(PLATFORMS)).min(1).max(4).optional(),
    caption: z.string().max(2200).optional(),
    scheduledAt: z.string().datetime().optional(),
    status: z.enum(['scheduled', 'canceled']).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })
