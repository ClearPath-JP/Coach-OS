import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { ensureCoachWorkspaceForOnboarding } from '@/lib/onboarding-ensure-coach'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { onboardingCoachingSchema } from '@/lib/validations'

/**
 * POST /api/onboarding/coaching — save Step 2: coaching_types, current_client_count.
 * Coach only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`onboarding-coaching:${user.id}`, {
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

    const parsed = onboardingCoachingSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid input'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const coachingTypes = parsed.data.coaching_types ?? []
    const rawCount = parsed.data.current_client_count
    const validCount =
      typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount >= 0
        ? rawCount
        : typeof rawCount === 'string' && rawCount.trim() !== ''
          ? (() => {
              const n = parseInt(rawCount.trim(), 10)
              return !Number.isNaN(n) && n >= 0 ? n : null
            })()
          : null

    const { error } = await supabase
      .from('workspaces')
      .update({
        coaching_types: coachingTypes.length > 0 ? coachingTypes : null,
        current_client_count: validCount,
      })
      .eq('id', coachWorkspaceId)

    if (error) {
      return NextResponse.json({ error: 'Could not update workspace' }, { status: 500 })
    }
    return NextResponse.json({ data: 'Saved' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
