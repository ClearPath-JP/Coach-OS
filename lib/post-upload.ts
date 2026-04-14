import { NextResponse } from 'next/server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { programUploadFieldsSchema } from '@/lib/validations'
import { logAuditEvent } from '@/lib/audit-log'
import {
  generateSafeStoragePath,
  isAllowedDocumentType,
  isAllowedImageType,
  MAX_DOCUMENT_SIZE,
  MAX_IMAGE_SIZE,
  normalizeImageMime,
  sanitizeFileName,
  validateDocumentMagicBytes,
  validateImageMagicBytes,
} from '@/lib/file-validation'

const UPLOAD_TYPES = ['avatar', 'logo', 'program-file', 'program-thumbnail'] as const
type UploadType = (typeof UPLOAD_TYPES)[number]

function jsonError(message: string, status: number, retryAfter?: number) {
  const res = NextResponse.json({ error: message }, { status })
  if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
  return res
}

export async function handleUploadPost(request: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return jsonError('Unauthorized', 401)
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return jsonError('Forbidden', 403)
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`upload:${user.id}`, {
      windowMs: 3_600_000,
      max: 20,
    })
    if (!rateOk) {
      return jsonError('Too many uploads — try again in an hour', 429, retryAfter)
    }

    const coachWorkspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!coachWorkspaceId) {
      return jsonError('Forbidden', 403)
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return jsonError('Missing or empty file', 400)
    }

    let uploadType = String(formData.get('type') ?? '').trim() as UploadType
    if (!UPLOAD_TYPES.includes(uploadType)) {
      const moduleId = formData.get('moduleId')
      const workspaceId = formData.get('workspaceId')
      if (moduleId != null && workspaceId != null) {
        uploadType = 'program-file'
      } else {
        return jsonError('Invalid or missing type (avatar | logo | program-file | program-thumbnail)', 400)
      }
    }

    const mimeRaw = (file.type || '').toLowerCase().trim()
    const buffer = await file.arrayBuffer()

    let storagePath: string
    let bucket: string
    let contentType: string

    if (uploadType === 'avatar' || uploadType === 'logo') {
      if (!isAllowedImageType(mimeRaw)) {
        return jsonError('Only JPEG, PNG, WebP, and GIF images are allowed', 400)
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return jsonError('Image must be under 5MB', 400)
      }
      const okMagic = await validateImageMagicBytes(buffer)
      if (!okMagic) {
        return jsonError('File content does not match an allowed image format', 400)
      }
      contentType = normalizeImageMime(mimeRaw)
      const safeBase = sanitizeFileName(file.name || 'image.jpg')
      if (uploadType === 'avatar') {
        bucket = 'avatars'
        storagePath = generateSafeStoragePath(user.id, 'avatars', safeBase)
      } else {
        bucket = 'avatars'
        storagePath = generateSafeStoragePath(coachWorkspaceId, 'workspaces', safeBase)
      }
    } else if (uploadType === 'program-thumbnail') {
      if (!isAllowedImageType(mimeRaw)) {
        return jsonError('Only JPEG, PNG, and WebP images are allowed', 400)
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return jsonError('Image must be under 5MB', 400)
      }
      const okMagic = await validateImageMagicBytes(buffer)
      if (!okMagic) {
        return jsonError('File content does not match an allowed image format', 400)
      }
      contentType = normalizeImageMime(mimeRaw)
      const safeBase = sanitizeFileName(file.name || 'thumbnail.jpg')
      const ext = safeBase.split('.').pop() || 'jpg'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      bucket = 'avatars'
      storagePath = `program-thumbnails/${coachWorkspaceId}/${safeName}`
    } else {
      const moduleId = formData.get('moduleId')
      const workspaceId = formData.get('workspaceId')
      if (moduleId == null || workspaceId == null) {
        return jsonError('program-file requires moduleId and workspaceId', 400)
      }
      const fieldsParsed = programUploadFieldsSchema.safeParse({
        moduleId: String(moduleId).trim(),
        workspaceId: String(workspaceId).trim(),
      })
      if (!fieldsParsed.success) {
        const msg = fieldsParsed.error.issues[0]?.message ?? 'Invalid module or workspace'
        return jsonError(msg, 400)
      }
      if (fieldsParsed.data.workspaceId !== coachWorkspaceId) {
        return jsonError('Forbidden', 403)
      }
      const { moduleId: validModuleId, workspaceId: validWorkspaceId } = fieldsParsed.data

      const isImg = isAllowedImageType(mimeRaw)
      const isDoc = isAllowedDocumentType(mimeRaw)
      if (!isImg && !isDoc) {
        return jsonError('File type not allowed for program content', 400)
      }
      if (isImg && file.size > MAX_IMAGE_SIZE) {
        return jsonError('Image must be under 5MB', 400)
      }
      if (isDoc && file.size > MAX_DOCUMENT_SIZE) {
        return jsonError('Document must be under 10MB', 400)
      }
      const magicOk = isImg
        ? await validateImageMagicBytes(buffer)
        : await validateDocumentMagicBytes(buffer, mimeRaw)
      if (!magicOk) {
        return jsonError('File content does not match the declared type', 400)
      }
      contentType = isImg ? normalizeImageMime(mimeRaw) : mimeRaw
      const safeBase = sanitizeFileName(file.name || 'file')
      const ext = safeBase.split('.').pop() || 'bin'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      storagePath = `programs/${validWorkspaceId}/${validModuleId}/${safeName}`
      bucket = 'programs'
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      return jsonError('Upload failed', 500)
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path)
    const url = urlData.publicUrl

    void logAuditEvent(
      'file_uploaded',
      user.id,
      coachWorkspaceId,
      { uploadType, path: storagePath, bucket },
      request
    )

    return NextResponse.json({ data: { url, fileUrl: url } })
  } catch {
    return jsonError('Something went wrong — try again', 500)
  }
}
