import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { getValidAccessToken } from '@/lib/google-drive'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/google-drive/files — list video files in the workspace import folder.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId } = auth

    const { searchParams } = new URL(request.url)
    const folderIdParam = searchParams.get('folderId')?.trim()

    const service = createServiceClient()
    const { data: ws } = await service
      .from('workspaces')
      .select('google_drive_import_folder_id')
      .eq('id', workspaceId)
      .maybeSingle()

    const folderId = folderIdParam || ws?.google_drive_import_folder_id?.trim() || null
    if (!folderId) {
      return NextResponse.json({ error: 'No folder configured' }, { status: 400 })
    }

    const { data: conn } = await service
      .from('google_drive_connections')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!conn) {
      return NextResponse.json({ error: 'Google Drive not connected' }, { status: 404 })
    }

    const accessToken = await getValidAccessToken(workspaceId)
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Could not access Google Drive — reconnect in Settings' },
        { status: 401 }
      )
    }

    const escapedFolder = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const q = `'${escapedFolder}' in parents and mimeType contains 'video/' and trashed = false`
    const fields =
      'files(id,name,size,mimeType,thumbnailLink,webViewLink,createdTime,modifiedTime,videoMediaMetadata),nextPageToken'
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc&pageSize=50`

    const driveRes = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => '')
      return NextResponse.json(
        { error: 'Drive API error', detail: errText.slice(0, 200) },
        { status: 502 }
      )
    }

    const driveJson = (await driveRes.json()) as {
      files?: Array<{
        id?: string
        name?: string
        size?: string
        mimeType?: string
        thumbnailLink?: string
        webViewLink?: string
        createdTime?: string
        modifiedTime?: string
        videoMediaMetadata?: { durationMillis?: string }
      }>
    }

    const rawFiles = driveJson.files ?? []

    const { data: importedRows } = await service
      .from('videos')
      .select('id, drive_file_id')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('drive_file_id', 'is', null)

    const driveIdToVideoId = new Map<string, string>()
    for (const r of importedRows ?? []) {
      const row = r as { id: string; drive_file_id: string | null }
      if (row.drive_file_id) driveIdToVideoId.set(row.drive_file_id, row.id)
    }

    const imported = new Set(driveIdToVideoId.keys())

    const files = rawFiles
      .filter((f) => f.id && f.name)
      .map((f) => {
        const id = f.id as string
        const sizeNum = f.size != null ? Number.parseInt(String(f.size), 10) : 0
        const durationMs = f.videoMediaMetadata?.durationMillis
        const durationSeconds =
          durationMs != null ? Math.round(Number.parseInt(String(durationMs), 10) / 1000) : null
        return {
          id,
          name: f.name ?? '',
          size: Number.isFinite(sizeNum) ? sizeNum : 0,
          mimeType: f.mimeType ?? 'video/*',
          thumbnailLink: f.thumbnailLink ?? null,
          webViewLink: f.webViewLink ?? null,
          createdTime: f.createdTime ?? null,
          modifiedTime: f.modifiedTime ?? null,
          durationSeconds,
          alreadyImported: imported.has(id),
          libraryVideoId: driveIdToVideoId.get(id) ?? null,
        }
      })

    return NextResponse.json({ data: { files } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
