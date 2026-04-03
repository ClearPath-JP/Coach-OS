import { NextResponse } from 'next/server'
import { getAccentLight } from '@/lib/accent-colors'
import { coerceToAllowedCoachAccent, isAllowedCoachAccentHex, type AccentColor } from '@/lib/coach-accent-phase4'
import { invalidateBrandingCache, invalidateSettingsCachesForWorkspace } from '@/lib/api-cache'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/coach/settings — accent color for the signed-in coach (workspace-scoped).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('accent_color')
      .eq('id', workspaceId)
      .maybeSingle()

    const raw = typeof workspace?.accent_color === 'string' ? workspace.accent_color.trim() : ''
    const accentColor = coerceToAllowedCoachAccent(raw || null)
    return NextResponse.json(
      { accentColor },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/coach/settings — update accent (whitelist only).
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`coach-settings:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = (await request.json().catch(() => null)) as { accentColor?: unknown } | null
    const accentColor = typeof body?.accentColor === 'string' ? body.accentColor.trim() : ''

    if (!isAllowedCoachAccentHex(accentColor)) {
      return NextResponse.json({ error: 'Invalid accent color' }, { status: 400 })
    }

    const canonical = accentColor.replace('#', '').toUpperCase()
    const hex = `#${canonical}` as AccentColor
    const light = getAccentLight(hex).toUpperCase()

    const { error } = await supabase
      .from('workspaces')
      .update({ accent_color: hex, accent_color_light: light })
      .eq('id', workspaceId)

    if (error) {
      return NextResponse.json({ error: 'Could not save accent color' }, { status: 500 })
    }

    void invalidateSettingsCachesForWorkspace(workspaceId)
    void invalidateBrandingCache(workspaceId)

    return NextResponse.json({ accentColor: hex })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
