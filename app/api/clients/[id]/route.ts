import { NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit-log'
import { requireCoach } from '@/lib/api-helpers'
import { calculateEngagementScore } from '@/lib/client-engagement'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail } from '@/lib/utils'
import { updateClientSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/clients/[id] — fetch one client by id (workspace-scoped).
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const { data, error } = await supabase
      .from('clients')
      .select(
        'id, workspace_id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, created_at, updated_at'
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Could not load client' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: rewards } = await supabase
      .from('client_rewards')
      .select(
        'total_xp, level, current_streak_days, longest_streak_days, assignments_completed, assignments_total, last_activity_at'
      )
      .eq('client_id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const rw = rewards ?? null
    const engagement = calculateEngagementScore({
      last_activity_at: rw?.last_activity_at ?? null,
      assignments_completed: rw?.assignments_completed ?? 0,
      assignments_total: rw?.assignments_total ?? 0,
      streak_days: rw?.current_streak_days ?? 0,
    })

    return NextResponse.json({ data: { ...data, rewards: rw, engagement } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/clients/[id] — update client fields (workspace-scoped).
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`clients-patch:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.first_name !== undefined) updates.first_name = parsed.data.first_name
    if (parsed.data.last_name !== undefined) updates.last_name = parsed.data.last_name
    if (parsed.data.email !== undefined) updates.email = parsed.data.email
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.goals !== undefined) updates.goals = parsed.data.goals
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes
    if (parsed.data.profile_photo_url !== undefined) {
      updates.profile_photo_url =
        parsed.data.profile_photo_url === '' || parsed.data.profile_photo_url === null
          ? null
          : parsed.data.profile_photo_url
    }

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Could not update client' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/clients/[id] — remove client row (DB cascades related rows); delete portal auth user when present.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id: clientId } = await params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`clients-delete:${user.id}`, {
      windowMs: 3_600_000,
      max: 20,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many delete attempts — try again later' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: row, error: fetchErr } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: 'Could not load client' }, { status: 500 })
    }
    if (!row?.id) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    const clientEmail = (row.email ?? '').trim()
    const emailNorm = clientEmail ? normalizeEmail(clientEmail) : ''

    let portalAuthUserId: string | null = null
    if (emailNorm) {
      try {
        const service = createServiceClient()
        const { data: prof } = await service
          .from('profiles')
          .select('id')
          .eq('email', emailNorm)
          .eq('role', 'client')
          .eq('workspace_id', workspaceId)
          .maybeSingle()
        if (prof?.id) portalAuthUserId = prof.id
      } catch {
        portalAuthUserId = null
      }
    }

    const { error: delErr, data: deletedRows } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .select('id')

    if (delErr) {
      return NextResponse.json({ error: 'Could not delete client' }, { status: 500 })
    }
    if (!deletedRows?.length) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    if (portalAuthUserId) {
      try {
        const service = createServiceClient()
        await service.auth.admin.deleteUser(portalAuthUserId)
      } catch {
        // best-effort: client row is already removed
      }
    }

    void logAuditEvent(
      'client_deleted',
      user.id,
      workspaceId,
      { clientId: row.id, clientEmail: emailNorm || clientEmail },
      request
    )

    return NextResponse.json({ data: { deleted: true } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
