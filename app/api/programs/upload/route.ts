import { NextResponse } from 'next/server'
import { handleUploadPost } from '@/lib/post-upload'

/**
 * @deprecated Prefer POST /api/upload with type=program-file (and moduleId, workspaceId).
 */
export async function POST(request: Request) {
  try {
    return await handleUploadPost(request)
  } catch (error) {
    console.error('[POST /api/programs/upload]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
