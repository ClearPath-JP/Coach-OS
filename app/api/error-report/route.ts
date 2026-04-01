import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/utils'

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(12000).optional(),
  componentStack: z.string().max(8000).optional(),
  routePath: z.string().max(500).optional(),
  source: z.enum(['window', 'unhandledrejection', 'react', 'manual']).optional(),
})

/**
 * Authenticated coaches/clients can report UI errors for super-admin review.
 * Rate limited; inserts with service role (no sensitive tokens in body).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (!user || authErr) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`error-report:user:${user.id}`, {
      windowMs: 60_000,
      max: 25,
    })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many reports' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role
    if (role !== 'coach' && role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const json = (await request.json().catch(() => null)) as unknown
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    let workspaceId: string | null = null
    if (role === 'coach') {
      const { data: coach } = await supabase
        .from('coaches')
        .select('workspace_id')
        .eq('user_id', user.id)
        .maybeSingle()
      workspaceId = coach?.workspace_id ?? null
    } else {
      if (user.email) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('workspace_id')
          .eq('email', normalizeEmail(user.email))
          .maybeSingle()
        workspaceId = clientRow?.workspace_id ?? null
      }
      if (!workspaceId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('workspace_id')
          .eq('id', user.id)
          .maybeSingle()
        workspaceId = prof?.workspace_id ?? null
      }
    }

    const service = createServiceClient()
    const { error: insertErr } = await service.from('frontend_error_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      user_email: user.email ?? profile?.email ?? null,
      role,
      route_path: parsed.data.routePath ?? null,
      error_message: parsed.data.message,
      error_stack: parsed.data.stack ?? null,
      component_stack: parsed.data.componentStack ?? null,
      client_meta: {
        source: parsed.data.source ?? 'unknown',
        ua: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
    })

    if (insertErr) {
      return NextResponse.json({ error: 'Could not save report' }, { status: 500 })
    }

    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Could not save report' }, { status: 500 })
  }
}
