import { createServiceClient } from '@/lib/supabase/service'
import { refreshGoogleAccessToken } from '@/lib/drive-import/google-token'

/**
 * Returns a fresh Google OAuth access token for the workspace's Drive connection, or null if missing/invalid.
 */
export async function getValidAccessToken(workspaceId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('google_drive_connections')
    .select('refresh_token')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error || !data?.refresh_token) return null

  try {
    const t = await refreshGoogleAccessToken(data.refresh_token)
    return t.access_token
  } catch {
    return null
  }
}
