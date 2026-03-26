import { handleUploadPost } from '@/lib/post-upload'

/**
 * POST /api/upload — authenticated multipart upload (avatar | logo | program-file).
 * Validates MIME, size, magic bytes; rate limit 20/hour per user.
 */
export async function POST(request: Request) {
  return handleUploadPost(request)
}
