import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireCoach } from '@/lib/api-helpers'
import { resolveWorkspaceForDriveFolder } from '@/lib/drive-import/resolve-workspace-folder'
import { checkStorageLimit } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  /** Required when calling with N8N_CALLBACK_SECRET (must match workspace import folder). Ignored for coach session. */
  folderId: z.string().optional().nullable(),
  driveFileId: z.string().min(1),
  driveFileName: z.string().min(1),
  driveMimeType: z.string().min(1).optional(),
  driveThumbnailUrl: z.string().optional().nullable(),
  driveWebViewLink: z.string().optional().nullable(),
  fileSizeBytes: z.coerce.number().int().nonnegative().optional(),
  durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  title: z.string().optional().nullable(),
})

const videoRowSelect =
  'id, workspace_id, coach_id, title, description, category, drive_file_id, drive_file_name, drive_folder_id, drive_mime_type, drive_thumbnail_url, drive_web_view_link, processing_status, playback_url, thumbnail_url, duration_seconds, file_size_bytes, storage_provider, created_at, processed_at'

function titleFromDriveName(name: string): string {
  const n = name.trim() || 'video'
  return n.replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '')
}

function n8nAuth(request: Request): boolean {
  const secret = request.headers.get('x-clearpath-secret') ?? request.headers.get('X-Clearpath-Secret')
  const expected = process.env.N8N_CALLBACK_SECRET?.trim()
  if (!expected || !secret) return false
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(secret, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * POST /api/videos/import-from-drive — register a Drive file for server-side processing (CloudConvert, etc.).
 *
 * - **Coach session:** no secret; uses workspace’s saved `google_drive_import_folder_id`.
 * - **n8n / automation:** header `X-Clearpath-Secret` = `N8N_CALLBACK_SECRET`; body must include `folderId`
 *   (the Drive folder the file lives in, usually `parents[0]`). Resolves workspace + coach so one workflow
 *   can serve many coaches, each with their own folder ID saved in ClearPath.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const driveMimeType = parsed.data.driveMimeType?.trim() || 'video/mp4'
    const fileSizeBytes = parsed.data.fileSizeBytes ?? 0

    const service = createServiceClient()
    const isN8n = n8nAuth(request)

    let workspaceId: string
    let coachUserId: string
    let folderId: string
    let supabaseForInsert: SupabaseClient

    if (isN8n) {
      const fid = parsed.data.folderId?.trim()
      if (!fid) {
        return NextResponse.json(
          { error: 'folderId is required when using X-Clearpath-Secret (n8n automation)' },
          { status: 400 }
        )
      }
      const resolved = await resolveWorkspaceForDriveFolder(service, fid)
      if (!resolved) {
        return NextResponse.json(
          { error: 'No workspace registered for this Drive folder — coach must save folder ID in ClearPath first' },
          { status: 404 }
        )
      }
      workspaceId = resolved.workspaceId
      coachUserId = resolved.coachId
      folderId = fid
      supabaseForInsert = service
    } else {
      const auth = await requireCoach()
      if ('error' in auth) return auth.error
      workspaceId = auth.workspaceId
      coachUserId = auth.user.id
      supabaseForInsert = auth.supabase

      const { data: ws } = await service
        .from('workspaces')
        .select('google_drive_import_folder_id')
        .eq('id', workspaceId)
        .maybeSingle()

      const fid = ws?.google_drive_import_folder_id?.trim() || null
      if (!fid) {
        return NextResponse.json(
          { error: 'No Google Drive import folder configured — set it in Settings first' },
          { status: 400 }
        )
      }
      folderId = fid
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`videos-import-drive:${coachUserId}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many imports — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
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

    const { allowed } = await checkStorageLimit(workspaceId, fileSizeBytes, 'video')
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

    const { data: video, error: insErr } = await supabaseForInsert
      .from('videos')
      .insert({
        workspace_id: workspaceId,
        coach_id: coachUserId,
        title,
        description: null,
        drive_file_id: parsed.data.driveFileId,
        drive_folder_id: folderId,
        drive_file_name: parsed.data.driveFileName,
        drive_mime_type: driveMimeType,
        drive_thumbnail_url: thumb,
        drive_web_view_link: webView,
        file_size_bytes: fileSizeBytes,
        duration_seconds: duration,
        processing_status: 'ready',
        processing_error: null,
        url: null,
        playback_url: null,
        thumbnail_url: thumb,
        storage_provider: null,
        processed_at: new Date().toISOString(),
      })
      .select(videoRowSelect)
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
