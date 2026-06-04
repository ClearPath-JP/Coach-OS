import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkStorageLimit } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'
import {
  sanitizeFileName,
  isAllowedImageType,
  validateImageMagicBytes,
  validateDocumentMagicBytes,
} from '@/lib/file-validation'

const MAX_FILE = 10 * 1024 * 1024

const FILE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

/**
 * POST /api/client/assignment-upload — multipart: kind=file only. Video uploads use POST /api/client/videos/upload.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`client-assignment-upload:${user.id}`, {
      windowMs: 3_600_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many uploads — try again later' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const formData = await request.formData()
    const kind = String(formData.get('kind') ?? '').trim()
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Missing or empty file' }, { status: 400 })
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

    const mime = (file.type || '').toLowerCase().trim()

    if (kind === 'file') {
      if (!FILE_MIMES.has(mime)) {
        return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
      }
      if (file.size > MAX_FILE) {
        return NextResponse.json({ error: 'File must be 10MB or smaller' }, { status: 400 })
      }
      const { allowed } = await checkStorageLimit(workspaceId, file.size, 'assignment_file')
      if (!allowed) {
        return NextResponse.json({ error: 'Assignment file storage limit reached' }, { status: 400 })
      }

      const buf = await file.arrayBuffer()

      const magicOk = isAllowedImageType(mime)
        ? await validateImageMagicBytes(buf)
        : await validateDocumentMagicBytes(buf, mime)
      if (!magicOk) {
        return NextResponse.json({ error: 'File content does not match its declared type' }, { status: 400 })
      }

      const safe = sanitizeFileName(file.name || 'document')
      const path = `assignment-files/${workspaceId}/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`

      const { data: up, error: upErr } = await service.storage.from('programs').upload(path, buf, {
        contentType: mime,
        upsert: false,
      })
      if (upErr) {
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }

      const { data: pub } = service.storage.from('programs').getPublicUrl(up.path)
      return NextResponse.json({
        data: { fileUrl: pub.publicUrl, fileSizeBytes: file.size },
      })
    }

    return NextResponse.json({ error: 'kind must be file' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
