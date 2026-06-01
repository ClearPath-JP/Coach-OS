import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { LEAD_STATUSES } from '@/lib/leads-interactions'

const schema = z.object({
  leadKey: z.string().trim().min(1).max(300),
  status: z.enum(LEAD_STATUSES as [string, ...string[]]).optional(),
  notes: z.string().max(4000).nullable().optional(),
  savedClientId: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`leads-interaction:${user.id}`, { windowMs: 60_000, max: 120 })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    const { leadKey, status, notes, savedClientId } = parsed.data
    if (status === undefined && notes === undefined && savedClientId === undefined)
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const service = createServiceClient()
    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updateFields.status = status
    if (notes !== undefined) updateFields.notes = notes
    if (savedClientId !== undefined) updateFields.saved_client_id = savedClientId

    // Try UPDATE first (preserves original coach_id / created_at).
    const { data: updated, error: updateError } = await service
      .from('lead_interactions')
      .update(updateFields)
      .eq('workspace_id', workspaceId)
      .eq('lead_key', leadKey)
      .select('lead_key, status, notes, saved_client_id')
      .maybeSingle()

    if (updateError) {
      console.error('PATCH /api/coach/leads/interaction update', updateError)
      return NextResponse.json({ error: 'Could not save' }, { status: 500 })
    }

    if (updated) return NextResponse.json({ data: updated })

    // Row doesn't exist yet — INSERT with coach_id.
    const insertRow: Record<string, unknown> = {
      workspace_id: workspaceId,
      coach_id: user.id,
      lead_key: leadKey,
      updated_at: new Date().toISOString(),
      ...updateFields,
    }

    const { data: inserted, error: insertError } = await service
      .from('lead_interactions')
      .insert(insertRow)
      .select('lead_key, status, notes, saved_client_id')
      .single()

    if (insertError) {
      // Race: another request inserted between our UPDATE and INSERT. Re-fetch.
      if (insertError.code === '23505') {
        const { data: refetch } = await service
          .from('lead_interactions')
          .select('lead_key, status, notes, saved_client_id')
          .eq('workspace_id', workspaceId)
          .eq('lead_key', leadKey)
          .single()
        if (refetch) return NextResponse.json({ data: refetch })
      }
      console.error('PATCH /api/coach/leads/interaction insert', insertError)
      return NextResponse.json({ error: 'Could not save' }, { status: 500 })
    }

    return NextResponse.json({ data: inserted })
  } catch (err) {
    console.error('PATCH /api/coach/leads/interaction', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
