import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { emptyStrictBodySchema } from '@/lib/validations'

/**
 * PATCH /api/workspaces/complete-onboarding — set completed_onboarding = true.
 * Coach only. Called only from onboarding step 4 (success screen).
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`complete-onboarding:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let raw: unknown = {}
    try {
      const text = await request.text()
      if (text.trim()) raw = JSON.parse(text) as unknown
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const bodyParsed = emptyStrictBodySchema.safeParse(raw)
    if (!bodyParsed.success) {
      return NextResponse.json({ error: 'Request body must be an empty JSON object' }, { status: 400 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('workspaces')
      .update({ completed_onboarding: true })
      .eq('id', coach.workspace_id)

    if (error) {
      return NextResponse.json({ error: 'Could not complete onboarding' }, { status: 500 })
    }
    return NextResponse.json({ data: 'Onboarding complete' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
