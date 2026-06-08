import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { createBunnyVideo, bunnyConfigured } from '@/lib/bunny'
import { checkStorageLimit } from '@/lib/plan-limits'

const schema = z.object({
  title: z.string().trim().max(200).optional(),
  // Required so the plan storage cap is always enforced — both the Videos-library
  // uploader and the Promote video step send the real upload size.
  fileSizeBytes: z.number().int().positive(),
})

/**
 * POST /api/coach/promote/bunny/create
 * Creates a Bunny Stream video object + returns TUS upload credentials for a
 * direct browser→Bunny upload. Records a `videos` row (provider 'bunny').
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`promote-bunny-create:${user.id}`, {
      windowMs: 60_000,
      max: 10,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many uploads — wait a moment and try again' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    if (!bunnyConfigured()) {
      return NextResponse.json(
        { error: 'Video upload is not configured yet — needs Bunny Stream env vars.' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const title = parsed.data.title?.trim() || 'Coach clip'
    const fileSizeBytes = parsed.data.fileSizeBytes

    // Enforce the plan's video-storage cap before creating the Bunny object.
    const { allowed, usedGb, maxGb } = await checkStorageLimit(workspaceId, fileSizeBytes, 'video')
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Storage full — this clip would exceed your ${maxGb} GB video limit (${usedGb.toFixed(1)} GB used). Upgrade your plan or remove a video.`,
        },
        { status: 413 }
      )
    }

    const created = await createBunnyVideo(title)

    // Track the upload (best-effort — don't block the upload if this fails).
    const service = createServiceClient()
    const { data: row, error } = await service
      .from('videos')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title,
        storage_provider: 'bunny',
        bunny_library_id: created.libraryId,
        bunny_video_guid: created.videoId,
        processing_status: 'processing',
        // Store the upload size so Bunny videos count toward the storage meter.
        file_size_bytes: fileSizeBytes,
      })
      .select('id')
      .single()
    if (error) console.error('POST /api/coach/promote/bunny/create videos insert', error)

    return NextResponse.json({ data: { ...created, dbId: row?.id ?? null } })
  } catch (err) {
    console.error('POST /api/coach/promote/bunny/create', err)
    return NextResponse.json({ error: 'Could not start the upload — try again' }, { status: 500 })
  }
}
