import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { ensureCoachWorkspaceForOnboarding } from '@/lib/onboarding-ensure-coach'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { onboardingWorkspaceSchema } from '@/lib/validations'

/**
 * POST /api/onboarding/workspace — save Step 1: workspace name, logo_url, avatar (profile) URL.
 * Coach only; updates workspaces and coach_profiles.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`onboarding-workspace:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const ensured = await ensureCoachWorkspaceForOnboarding(supabase, user)
    if ('error' in ensured) {
      return NextResponse.json({ error: ensured.error }, { status: ensured.status })
    }
    const coachWorkspaceId = ensured.workspaceId

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = onboardingWorkspaceSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid input'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { name, logo_url: logoUrlRaw, avatar_url: avatarUrlRaw } = parsed.data
    const logoUrl =
      logoUrlRaw === undefined || logoUrlRaw === '' || logoUrlRaw === null
        ? null
        : typeof logoUrlRaw === 'string'
          ? logoUrlRaw.trim() || null
          : null
    const avatarUrl =
      avatarUrlRaw === undefined || avatarUrlRaw === '' || avatarUrlRaw === null
        ? null
        : typeof avatarUrlRaw === 'string'
          ? avatarUrlRaw.trim() || null
          : null

    const { error: workspaceError } = await supabase
      .from('workspaces')
      .update({ name, logo_url: logoUrl })
      .eq('id', coachWorkspaceId)

    if (workspaceError) {
      return NextResponse.json({ error: 'Could not update workspace' }, { status: 500 })
    }

    if (avatarUrl !== null) {
      const { error: profileAvatarErr } = await supabase
        .from('profiles')
        .update({ logo_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (profileAvatarErr) {
        return NextResponse.json(
          { error: 'Could not save profile photo' },
          { status: 500 }
        )
      }

      const { data: existing } = await supabase
        .from('coach_profiles')
        .select('coach_id')
        .eq('coach_id', user.id)
        .maybeSingle()
      if (existing) {
        await supabase
          .from('coach_profiles')
          .update({ profile_image_url: avatarUrl, updated_at: new Date().toISOString() })
          .eq('coach_id', user.id)
      } else {
        await supabase.from('coach_profiles').insert({
          coach_id: user.id,
          workspace_id: coachWorkspaceId,
          profile_image_url: avatarUrl,
        })
      }
    }

    return NextResponse.json({ data: 'Saved' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
