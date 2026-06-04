import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Best-effort: record a server-side error into the existing frontend_error_logs table
 * so it shows in /admin. NEVER throws — a logging failure must not break the request.
 *
 * Maps to real columns:
 *   route_path     ← context  (e.g. 'POST /api/webhooks/stripe')
 *   error_message  ← error message (max 2000 chars)
 *   error_stack    ← error stack   (max 12000 chars, nullable)
 *   role           ← 'server'  (a value the schema allows and distinguishes from 'coach'/'client')
 *   client_meta    ← { source: 'server', ...meta }
 *   workspace_id, user_id, user_email, component_stack ← null (all nullable)
 */
export async function logServerError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const service = createServiceClient()
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? (error.stack ?? null) : null

    await service.from('frontend_error_logs').insert({
      workspace_id: null,
      user_id: null,
      user_email: null,
      role: 'server',
      route_path: context.slice(0, 500),
      error_message: message.slice(0, 2000),
      error_stack: stack ? stack.slice(0, 12000) : null,
      component_stack: null,
      client_meta: { source: 'server', ...(meta ?? {}) },
    })
  } catch {
    // Swallow — logging must never break the caller.
  }
}
