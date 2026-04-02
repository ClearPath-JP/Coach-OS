import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkStorageLimit } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'
import { sanitizeFileName, validateVideoMagicBytes } from '@/lib/file-validation'

export const dynamic = 'force-dynamic'

const MAX_VIDEO = 100 * 1024 * 1024

/**
 * POST /api/client/videos/upload — multipart file (video/*). Stores in assignment-submissions bucket; creates videos row for assignment submission.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`client-videos-upload:${user.id}`, {
      windowMs: 3_600_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many uploads — try again later' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Missing or empty file' }, { status: 400 })
    }

    const mime = (file.type || '').toLowerCase().trim()
    if (!mime.startsWith('video/')) {
      return NextResponse.json({ error: 'File must be a video' }, { status: 400 })
    }
    if (file.size > MAX_VIDEO) {
      return NextResponse.json({ error: 'Video must be 100MB or smaller' }, { status: 400 })
    }

    const buf = await file.arrayBuffer()
    const magicOk = await validateVideoMagicBytes(buf)
    if (!magicOk) {
      return NextResponse.json(
        { error: 'File content does not match a supported video format (e.g. MP4 or WebM)' },
        { status: 400 }
      )
    }

    const service = createServiceClient()

    const { data: clientRow, error: clErr } = await service
      .from('clients')
      .select('id, coach_id, workspace_id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (clErr || !clientRow?.coach_id) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { allowed } = await checkStorageLimit(workspaceId, file.size, 'video')
    if (!allowed) {
      return NextResponse.json({ error: 'Video storage limit reached for your plan' }, { status: 400 })
    }

    const safe = sanitizeFileName(file.name || 'video.mp4')
    const path = `${workspaceId}/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`

    const { data: up, error: upErr } = await service.storage.from('assignment-submissions').upload(path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (upErr) {
      return NextResponse.json(
        { error: 'Upload failed — check that storage is configured for assignment videos' },
        { status: 500 }
      )
    }

    const { data: pub } = service.storage.from('assignment-submissions').getPublicUrl(up.path)
    const playbackUrl = pub.publicUrl

    const { data: vid, error: vErr } = await service
      .from('videos')
      .insert({
        coach_id: clientRow.coach_id,
        workspace_id: workspaceId,
        uploaded_by_client_id: clientId,
        title: 'Assignment submission',
        description: null,
        url: playbackUrl,
        playback_url: playbackUrl,
        file_size_bytes: file.size,
        processing_status: 'ready',
        storage_provider: 'supabase',
        drive_file_id: null,
      })
      .select('id, playback_url')
      .single()

    if (vErr || !vid) {
      return NextResponse.json({ error: 'Could not save video record' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        videoId: vid.id,
        playbackUrl: vid.playback_url ?? playbackUrl,
        fileSizeBytes: file.size,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
