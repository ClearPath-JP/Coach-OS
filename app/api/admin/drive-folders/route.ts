import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function verifySecret(request: Request): boolean {
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
 * GET /api/admin/drive-folders
 *
 * Returns all workspaces that have a Google Drive import folder configured.
 * Secured by X-Clearpath-Secret header (n8n automation only).
 *
 * Response: { data: [{ workspaceId, folderId, workspaceName }] }
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, google_drive_import_folder_id')
    .not('google_drive_import_folder_id', 'is', null)
    .neq('google_drive_import_folder_id', '')

  if (error) {
    return NextResponse.json({ error: 'Could not fetch workspaces' }, { status: 500 })
  }

  const folders = (workspaces ?? []).map((w) => ({
    workspaceId: w.id,
    folderId: w.google_drive_import_folder_id!.trim(),
    workspaceName: w.name,
  }))

  return NextResponse.json({ data: folders })
}
