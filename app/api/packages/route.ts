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

    const key = packagesCacheKey(workspaceId)
    const rows = await withCache(key, 60, async () => {
      const { data, error } = await supabase
        .from('session_packages')
        .select('id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    })

    const res = NextResponse.json({ data: rows })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong — check your connection and try again'
    return NextResponse.json({ error: msg }, { status: 500 })
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

    const { data: row, error } = await supabase
      .from('session_packages')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        price_cents: parsed.data.price_cents,
        currency: parsed.data.currency ?? 'usd',
        duration_minutes: parsed.data.duration_minutes ?? 60,
        session_type: parsed.data.session_type ?? null,
        is_active: parsed.data.is_active ?? true,
      })
      .select('id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create package' },
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
