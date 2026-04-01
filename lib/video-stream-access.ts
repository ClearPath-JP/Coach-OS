import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail } from '@/lib/utils'

export type VideoStreamRow = {
  id: string
  workspace_id: string
  drive_file_id: string | null
  playback_url: string | null
  deleted_at: string | null
}

/**
 * Load video row needed for streaming (service role — call only after auth checks).
 */
export async function getVideoStreamRow(videoId: string): Promise<VideoStreamRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('videos')
    .select('id, workspace_id, drive_file_id, playback_url, deleted_at')
    .eq('id', videoId)
    .maybeSingle()

  if (error || !data || data.deleted_at) return null
  return data as VideoStreamRow
}

/**
 * Client may stream if the video is in an assigned program, direct video_assignment, or their assignment submission.
 */
export async function clientCanAccessVideo(clientId: string, videoId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: ownUpload } = await supabase
    .from('videos')
    .select('id')
    .eq('id', videoId)
    .eq('uploaded_by_client_id', clientId)
    .maybeSingle()

  if (ownUpload?.id) return true

  const { data: viaProgram } = await supabase
    .from('program_content')
    .select('id, module_id')
    .eq('video_id', videoId)
    .eq('content_type', 'video')
    .limit(50)

  const rows = viaProgram ?? []
  if (rows.length > 0) {
    const moduleIds = [...new Set(rows.map((r) => r.module_id).filter(Boolean))] as string[]
    const { data: modules } = await supabase.from('program_modules').select('id, program_id').in('id', moduleIds)

    const programIds = [...new Set((modules ?? []).map((m) => m.program_id).filter(Boolean))] as string[]
    if (programIds.length > 0) {
      const { data: assignment } = await supabase
        .from('client_programs')
        .select('id')
        .eq('client_id', clientId)
        .in('program_id', programIds)
        .in('status', ['active', 'completed'])
        .limit(1)
        .maybeSingle()

      if (assignment) return true
    }
  }

  const { data: direct } = await supabase
    .from('video_assignments')
    .select('id')
    .eq('video_id', videoId)
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()

  if (direct) return true

  const { data: submission } = await supabase
    .from('assignment_submissions')
    .select('id')
    .eq('video_id', videoId)
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()

  return !!submission
}

export async function coachOwnsVideoWorkspace(coachUserId: string, videoWorkspaceId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data: coach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', coachUserId)
    .maybeSingle()
  return coach?.workspace_id === videoWorkspaceId
}

export type StreamAccessOpts = {
  /** From signed stream token (Range playback). */
  tokenEmail?: string | null
  /** From `auth.getUser()` when using cookie session. */
  sessionEmail?: string | null
}

/**
 * Coach in the video's workspace, or client with program / direct assignment / submission access.
 */
export async function userCanStreamVideo(
  authUserId: string,
  videoId: string,
  workspaceId: string,
  opts?: StreamAccessOpts
): Promise<boolean> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', authUserId)
    .maybeSingle()

  if (profile?.role === 'coach') {
    return coachOwnsVideoWorkspace(authUserId, workspaceId)
  }

  if (profile?.role !== 'client') return false

  const emailRaw = opts?.tokenEmail ?? opts?.sessionEmail ?? profile.email ?? null
  if (!emailRaw?.trim()) return false

  const email = normalizeEmail(emailRaw)
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', email)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!client?.id) return false
  return clientCanAccessVideo(client.id, videoId)
}
