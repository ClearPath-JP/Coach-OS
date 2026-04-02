import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'

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
        'id, workspace_id, coach_id, title, description, category, drive_file_id, drive_file_name, drive_folder_id, drive_mime_type, drive_thumbnail_url, drive_web_view_link, processing_status, processing_error, playback_url, thumbnail_url, duration_seconds, file_size_bytes, storage_provider, created_at, processed_at'
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
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
