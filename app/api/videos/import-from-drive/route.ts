import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkStorageLimit } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  driveFileId: z.string().min(1),
  driveFileName: z.string().min(1),
  driveMimeType: z.string().min(1),
  driveThumbnailUrl: z.string().optional().nullable(),
  driveWebViewLink: z.string().optional().nullable(),
  fileSizeBytes: z.coerce.number().int().nonnegative(),
  durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  title: z.string().optional().nullable(),
})

function titleFromDriveName(name: string): string {
  const n = name.trim() || 'video'
  return n.replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '')
}

/**
 * POST /api/videos/import-from-drive — coach saves Drive file metadata only (no download, no n8n).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`videos-import-drive:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many imports — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: ws } = await service
      .from('workspaces')
      .select('google_drive_import_folder_id')
      .eq('id', workspaceId)
      .maybeSingle()

    const folderId = ws?.google_drive_import_folder_id?.trim() || null
    if (!folderId) {
      return NextResponse.json(
        { error: 'No Google Drive import folder configured — set it in Settings first' },
        { status: 400 }
      )
    }

    const { data: existing } = await service
      .from('videos')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('drive_file_id', parsed.data.driveFileId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing?.id) {
      return NextResponse.json({ data: { videoId: existing.id, alreadyImported: true } })
    }

    const size = parsed.data.fileSizeBytes
    const { allowed } = await checkStorageLimit(workspaceId, size, 'video')
    if (!allowed) {
      return NextResponse.json(
        { error: 'Video storage limit reached for your plan — remove videos or upgrade' },
        { status: 413 }
      )
    }

    const title =
      (parsed.data.title?.trim() ? parsed.data.title.trim() : null) ?? titleFromDriveName(parsed.data.driveFileName)

    const thumb = parsed.data.driveThumbnailUrl?.trim() || null
    const webView = parsed.data.driveWebViewLink?.trim() || null
    const duration =
      parsed.data.durationSeconds != null && Number.isFinite(parsed.data.durationSeconds)
        ? parsed.data.durationSeconds
        : null

    const { data: video, error: insErr } = await supabase
      .from('videos')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title,
        description: null,
        drive_file_id: parsed.data.driveFileId,
        drive_folder_id: folderId,
        drive_file_name: parsed.data.driveFileName,
        drive_mime_type: parsed.data.driveMimeType,
        drive_thumbnail_url: thumb,
        drive_web_view_link: webView,
        file_size_bytes: size,
        duration_seconds: duration,
        processing_status: 'ready',
        processing_error: null,
        url: null,
        playback_url: null,
        thumbnail_url: thumb,
        storage_provider: null,
        processed_at: new Date().toISOString(),
      })
      .select(
        'id, workspace_id, coach_id, title, description, category, drive_file_id, drive_file_name, drive_folder_id, drive_mime_type, drive_thumbnail_url, drive_web_view_link, processing_status, playback_url, thumbnail_url, duration_seconds, file_size_bytes, storage_provider, created_at, processed_at'
      )
      .single()

    if (insErr || !video) {
      return NextResponse.json(
        { error: 'Could not save video' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { video, alreadyImported: false } })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
