export type VideoCategory = {
  id: string
  name: string
  color: string
  position: number
}

export type Video = {
  id: string
  workspace_id: string
  coach_id: string
  title: string
  description: string | null
  category: string | null
  category_id: string | null
  shared_with_clients?: boolean | null
  drive_file_id: string | null
  drive_file_name: string | null
  drive_folder_id?: string | null
  drive_mime_type?: string | null
  drive_thumbnail_url?: string | null
  drive_web_view_link?: string | null
  processing_status: 'queued' | 'processing' | 'ready' | 'failed' | 'deleted'
  processing_error: string | null
  playback_url: string | null
  /** Signed Bunny MP4 fallback (hover-preview source). Null until MP4 fallback is enabled + transcoded. */
  mp4_url?: string | null
  /** Bunny iframe player URL — plays HLS cross-browser. Present only for Bunny-hosted videos. */
  embed_url?: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  storage_provider: string | null
  created_at: string
  processed_at: string | null
}
