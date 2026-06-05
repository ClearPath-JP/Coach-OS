import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { signBunnyUrl, bunnyEmbedUrl } from '@/lib/bunny'

const STATUS_VALUES = ['ready', 'processing', 'failed', 'queued'] as const

export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim()

    let query = supabase
      .from('videos')
      .select(
        'id, workspace_id, coach_id, title, description, category, category_id, drive_file_id, drive_file_name, drive_folder_id, drive_mime_type, drive_thumbnail_url, drive_web_view_link, processing_status, processing_error, playback_url, mp4_url, thumbnail_url, bunny_video_guid, bunny_library_id, duration_seconds, file_size_bytes, storage_provider, created_at, processed_at'
      )
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      query = query.eq('processing_status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Could not load videos' },
        { status: 500 }
      )
    }

    // For Bunny-hosted rows, attach the cross-browser iframe player URL and sign
    // the direct CDN media URLs (mp4 preview + thumbnail). signBunnyUrl is a no-op
    // when URL token auth is off, so this is safe whether or not it's enabled.
    const rows = (data ?? []) as Array<Record<string, unknown>>
    const mapped = rows.map((v) => {
      const guid = typeof v.bunny_video_guid === 'string' ? v.bunny_video_guid : null
      if (!guid) return v
      const libraryId =
        typeof v.bunny_library_id === 'string' || typeof v.bunny_library_id === 'number'
          ? String(v.bunny_library_id)
          : null
      const mp4 = typeof v.mp4_url === 'string' && v.mp4_url ? v.mp4_url : null
      const thumb = typeof v.thumbnail_url === 'string' && v.thumbnail_url ? v.thumbnail_url : null
      return {
        ...v,
        embed_url: bunnyEmbedUrl(guid, libraryId),
        mp4_url: mp4 ? signBunnyUrl(mp4) : null,
        thumbnail_url: thumb ? signBunnyUrl(thumb) : thumb,
      }
    })
    return NextResponse.json({ data: mapped })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
