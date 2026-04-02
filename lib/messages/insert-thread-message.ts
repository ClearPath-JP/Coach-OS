import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail } from '@/lib/utils'

/**
 * Insert a message in a coach↔client thread as the coach (sender = coach).
 * Used for automated check-ins and testimonial prompts. Bypasses RLS via service role.
 */
export async function insertCoachThreadMessageAsCoach(params: {
  workspaceId: string
  clientId: string
  coachUserId: string
  content: string
  messageType?: string
  /** Default 2000; session recap JSON may be longer */
  maxContentLength?: number
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const service = createServiceClient()
  const { data: client, error: cErr } = await service
    .from('clients')
    .select('id, workspace_id, email')
    .eq('id', params.clientId)
    .maybeSingle()
  if (cErr || !client?.email) {
    return { ok: false, error: 'Client not found or has no email' }
  }
  if (client.workspace_id !== params.workspaceId) {
    return { ok: false, error: 'Workspace mismatch' }
  }
  const email = normalizeEmail(client.email)
  const { data: clientProfile, error: pErr } = await service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (pErr || !clientProfile) {
    return { ok: false, error: 'Client has no portal account yet' }
  }
  const maxLen = params.maxContentLength ?? 2000
  const body = params.content.slice(0, maxLen)
  const { data: row, error: mErr } = await service
    .from('messages')
    .insert({
      workspace_id: params.workspaceId,
      sender_id: params.coachUserId,
      recipient_id: clientProfile.id,
      client_id: params.clientId,
      content: body,
      message_type: params.messageType ?? 'text',
    })
    .select('id')
    .single()
  if (mErr || !row) {
    return { ok: false, error: 'Could not insert message' }
  }
  return { ok: true, messageId: row.id }
}
