import { handleUploadPost } from '@/lib/post-upload'

/**
 * @deprecated Prefer POST /api/upload with type=program-file (and moduleId, workspaceId).
 */
export async function POST(request: Request) {
  return handleUploadPost(request)
}
