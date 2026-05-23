import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { invalidatePackagesCache, packagesCacheKey, withCache } from '@/lib/api-cache'
import { createPackageSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/packages — list session packages for the coach's workspace.
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`packages-get:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const selectFull =
      'id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_virtual, is_active, capacity, created_at'
    const selectBase =
      'id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at'

    const key = packagesCacheKey(workspaceId)
    const rows = await withCache(key, 60, async () => {
      const first = await supabase
        .from('session_packages')
        .select(selectFull)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (!first.error) return first.data ?? []
      if (/is_virtual|capacity|schema cache/i.test(first.error.message)) {
        const second = await supabase
          .from('session_packages')
          .select(selectBase)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
        if (second.error) throw new Error(second.error.message)
        return second.data ?? []
      }
      throw new Error(first.error.message)
    })

    const res = NextResponse.json({ data: rows })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    console.error('GET /api/packages', e)
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/packages — create a session package. Coach only.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-packages:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = createPackageSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const baseInsert = {
      workspace_id: workspaceId,
      coach_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      price_cents: parsed.data.price_cents,
      currency: parsed.data.currency ?? 'usd',
      duration_minutes: parsed.data.duration_minutes ?? 60,
      session_type: parsed.data.session_type ?? null,
      is_active: parsed.data.is_active ?? true,
      capacity: parsed.data.capacity ?? 1,
    }

    const selectFull =
      'id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_virtual, is_active, capacity, created_at'
    const selectBase =
      'id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at'

    let rowResult = await supabase
      .from('session_packages')
      .insert({
        ...baseInsert,
        is_virtual: parsed.data.is_virtual ?? true,
      })
      .select(selectFull)
      .single()

    if (rowResult.error && /is_virtual|capacity|schema cache/i.test(rowResult.error.message)) {
      // First insert likely succeeded but select failed — re-select instead of re-inserting
      rowResult = await supabase
        .from('session_packages')
        .select(selectBase)
        .eq('workspace_id', workspaceId)
        .eq('title', baseInsert.title)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    }

    const { data: row, error } = rowResult

    if (error) {
      return NextResponse.json(
        { error: 'Could not create package' },
        { status: 500 }
      )
    }
    void invalidatePackagesCache(workspaceId)
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
