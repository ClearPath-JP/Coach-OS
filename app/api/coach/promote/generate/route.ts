import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkDailyWorkspaceQuota } from '@/lib/spend-guard'
import { runPromoteGeneration } from '@/lib/promote-content'
import { logServerError } from '@/lib/log-server-error'

const generateSchema = z.object({
  kind: z.enum(['class', 'workout', 'book1on1', 'bts']),
  discipline: z.string().trim().max(80).optional(),
  topic: z.string().trim().max(500).optional(),
  tone: z.enum(['hype', 'calm', 'friendly']).optional(),
  mode: z.enum(['ideas', 'post', 'video']),
  platform: z.enum(['instagram', 'facebook']).optional(),
  bookingUrl: z.string().trim().max(300).optional(),
  signature: z.string().trim().max(200).optional(),
})

/**
 * POST /api/coach/promote/generate
 * Body: { kind, discipline?, topic?, tone?, mode: 'ideas' | 'post' }
 * Generates IG/FB post ideas or a full post via Claude. Stateless (nothing stored).
 * Content tools are available on all plans — no plan gating.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `promote-generate:${user.id}`,
      { windowMs: 60_000, max: 20, failMode: 'closed' }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many requests — wait a moment and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { allowed: quotaOk } = await checkDailyWorkspaceQuota(workspaceId, 'ai_generate', 100)
    if (!quotaOk) {
      return NextResponse.json(
        { error: 'Daily limit reached for this workspace — try again tomorrow.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = generateSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Content tools are not configured yet — needs ANTHROPIC_API_KEY.' },
        { status: 503 }
      )
    }

    try {
      const outcome = await runPromoteGeneration({
        kind: parsed.data.kind,
        mode: parsed.data.mode,
        discipline: parsed.data.discipline ?? null,
        topic: parsed.data.topic ?? null,
        tone: parsed.data.tone ?? null,
        platform: parsed.data.platform ?? null,
        bookingUrl: parsed.data.bookingUrl ?? null,
        signature: parsed.data.signature ?? null,
      })
      return NextResponse.json({ data: outcome })
    } catch (err) {
      console.error('POST /api/coach/promote/generate runPromoteGeneration', err)
      return NextResponse.json({ error: 'Could not generate — try again' }, { status: 502 })
    }
  } catch (err) {
    await logServerError('POST /api/coach/promote/generate', err)
    console.error('POST /api/coach/promote/generate', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
