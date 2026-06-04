import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const schema = z.object({
  name: z.string().trim().max(120),
  handle: z.string().trim().max(120).nullable().optional(),
  platform: z.string().trim().max(40).optional(),
  reason: z.string().trim().max(400).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  discipline: z.string().trim().max(80).optional(),
  gymName: z.string().trim().max(120).optional(),
  area: z.string().trim().max(80).optional(),
})

const SYSTEM = `You write short, warm, NON-salesy Instagram DMs for a local fitness/martial-arts coach reaching out to a potential client or partner. 2-4 sentences, friendly, specific to the person, one soft call to action (offer a free intro/form-check). At most one emoji. No hashtags. Output ONLY the message text.`

/**
 * POST /api/coach/leads/outreach — generate a short outreach DM for a lead.
 * On demand (button), not persisted. Coach context (discipline/gym/area) is passed in.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`leads-outreach:${user.id}`, {
      windowMs: 60_000,
      max: 20,
      failMode: 'closed',
    })
    if (!success) {
      const r = NextResponse.json({ error: 'Too many requests — wait a minute' }, { status: 429 })
      if (retryAfter) r.headers.set('Retry-After', String(retryAfter))
      return r
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI is not configured' }, { status: 503 })
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const p = parsed.data

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `Coach: ${p.discipline ?? 'fitness'} coach${p.gymName ? ' at ' + p.gymName : ''}${p.area ? ' in ' + p.area : ''}.\n` +
            `Lead: ${p.name}${p.handle ? ' (' + p.handle + ')' : ''} on ${p.platform ?? 'instagram'}.\n` +
            `Why they're a fit: ${p.reason ?? 'local, interested in training'}.\n` +
            (p.bio ? `Their bio: ${p.bio}\n` : '') +
            `Write the DM.`,
        },
      ],
    })

    let text = ''
    for (const b of resp.content) if (b.type === 'text') text += b.text
    return NextResponse.json({ data: { text: text.trim() } })
  } catch (err) {
    console.error('POST /api/coach/leads/outreach', err)
    return NextResponse.json({ error: 'Could not generate a message' }, { status: 502 })
  }
}
