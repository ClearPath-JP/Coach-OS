import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { validateAudioMagicBytes } from '@/lib/file-validation'
import { STUDIO_AUDIO_BUCKET } from '@/lib/studio/timeline'
import { logServerError } from '@/lib/log-server-error'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const MAX_BYTES = 25 * 1024 * 1024
const EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/m4a': 'm4a',
}

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth

  const rate = await checkRateLimitAsync(`studio-audio:${user.id}`, { windowMs: 60_000, max: 20, failMode: 'open' })
  if (!rate.success) return NextResponse.json({ error: 'Too many uploads — wait a moment.' }, { status: 429 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }

  const kind = String(form.get('kind') ?? '')
  if (kind !== 'music' && kind !== 'voiceover') return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Audio too large (max 25MB)' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  if (!validateAudioMagicBytes(buf)) return NextResponse.json({ error: 'Not a valid audio file' }, { status: 400 })

  const mime = file.type && EXT[file.type] ? file.type : 'audio/mpeg'
  const ext = EXT[mime] ?? 'mp3'
  const path = `${workspaceId}/${kind}-${randomUUID()}.${ext}`

  try {
    const service = createServiceClient()
    const { data: up, error } = await service.storage.from(STUDIO_AUDIO_BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (error) throw error
    const { data: pub } = service.storage.from(STUDIO_AUDIO_BUCKET).getPublicUrl(up.path)
    return NextResponse.json({ data: { path: up.path, url: pub.publicUrl } }, { status: 201 })
  } catch (err) {
    await logServerError('POST /api/studio/audio', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
