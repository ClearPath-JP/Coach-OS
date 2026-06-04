import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkDailyWorkspaceQuota } from '@/lib/spend-guard'
import { runPromoteChat, type ChatMessage } from '@/lib/promote-content'
import { logServerError } from '@/lib/log-server-error'

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
  discipline: z.string().trim().max(80).optional(),
  tone: z.enum(['hype', 'calm', 'friendly']).optional(),
  finalize: z.boolean().optional(),
})

/**
 * POST /api/coach/promote/chat
 * Body: { messages: [{role, content}], discipline?, tone?, finalize? }
 * finalize=false → { data: { kind: 'reply', reply } }
 * finalize=true  → { data: { kind: 'post', post } }
 * Stateless, no plan gating (content tools = all plans).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `promote-chat:${user.id}`,
      { windowMs: 60_000, max: 30, failMode: 'closed' }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many messages — wait a moment and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { allowed: quotaOk } = await checkDailyWorkspaceQuota(workspaceId, 'ai_chat', 200)
    if (!quotaOk) {
      return NextResponse.json(
        { error: 'Daily limit reached for this workspace — try again tomorrow.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = chatSchema.safeParse(body)
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
      const outcome = await runPromoteChat(
        parsed.data.messages as ChatMessage[],
        { discipline: parsed.data.discipline ?? null, tone: parsed.data.tone ?? null },
        parsed.data.finalize ?? false
      )
      return NextResponse.json({ data: outcome })
    } catch (err) {
      console.error('POST /api/coach/promote/chat runPromoteChat', err)
      return NextResponse.json({ error: 'Could not respond — try again' }, { status: 502 })
    }
  } catch (err) {
    await logServerError('POST /api/coach/promote/chat', err)
    console.error('POST /api/coach/promote/chat', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
