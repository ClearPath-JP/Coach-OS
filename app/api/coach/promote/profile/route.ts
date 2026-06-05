import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { promoteProfileSchema } from '@/lib/validations'
import { logServerError } from '@/lib/log-server-error'

const PROFILE_COLUMNS = 'workspace_id, discipline, tone, platform, booking_url, signature, updated_at'

/**
 * GET /api/coach/promote/profile — the workspace's saved brand voice (or null).
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const { data, error } = await supabase
      .from('promote_profile')
      .select(PROFILE_COLUMNS)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Could not load brand voice' }, { status: 500 })
    return NextResponse.json({ data: data ?? null })
  } catch (err) {
    await logServerError('GET /api/coach/promote/profile', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * PATCH /api/coach/promote/profile — upsert brand voice (one row per workspace).
 * workspace_id is server-derived; never taken from the body.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`promote-profile:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const raw = await request.json().catch(() => null)
    const parsed = promoteProfileSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const d = parsed.data

    const row: Record<string, unknown> = {
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    }
    if (d.discipline !== undefined) row.discipline = d.discipline === null ? null : d.discipline.trim() || null
    if (d.tone !== undefined) row.tone = d.tone
    if (d.platform !== undefined) row.platform = d.platform
    if (d.bookingUrl !== undefined) row.booking_url = d.bookingUrl && d.bookingUrl.trim() ? d.bookingUrl.trim() : null
    if (d.signature !== undefined) row.signature = d.signature === null ? null : d.signature.trim() || null

    const { data, error } = await supabase
      .from('promote_profile')
      .upsert(row, { onConflict: 'workspace_id' })
      .select(PROFILE_COLUMNS)
      .maybeSingle()

    if (error) {
      await logServerError('PATCH /api/coach/promote/profile upsert', error)
      return NextResponse.json({ error: 'Could not save brand voice' }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    await logServerError('PATCH /api/coach/promote/profile', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
