import { NextResponse } from 'next/server'
import { handleUploadPost } from '@/lib/post-upload'

/**
 * POST /api/upload — authenticated multipart upload (avatar | logo | program-file).
 * Validates MIME, size, magic bytes; rate limit 20/hour per user.
 */
export async function POST(request: Request) {
  try {
    return await handleUploadPost(request)
  } catch (error) {
    console.error('[POST /api/upload]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
