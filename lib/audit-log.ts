import { createServiceClient } from '@/lib/supabase/service'

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'password_changed'
  | 'client_invited'
  | 'client_deleted'
  | 'invoice_paid'
  | 'subscription_changed'
  | 'file_uploaded'
  | 'suspicious_request'

export async function logAuditEvent(
  action: AuditAction,
  userId: string | null,
  workspaceId: string | null,
  metadata: Record<string, unknown>,
  request: Request
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const event = {
      action,
      user_id: userId,
      workspace_id: workspaceId,
      ip_address: ip.slice(0, 64),
      user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
      metadata,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('audit_logs').insert(event)
    if (error && process.env.NODE_ENV === 'development') {
      console.warn('audit_logs insert:', error.message)
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('logAuditEvent:', e)
    }
  }
}
