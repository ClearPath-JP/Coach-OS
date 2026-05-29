import Anthropic from '@anthropic-ai/sdk'

/**
 * Promote content studio engine.
 * Generates IG/FB post ideas + full posts (hook/caption/hashtags/CTA + optional
 * Reel script) for a local coach. Stateless — generate → copy → post manually.
 * Reuses the Claude pattern from lib/lead-research.ts (claude-sonnet-4-6).
 * Content tools are available on ALL plans (no gating).
 */

export type PromoteKind = 'class' | 'workout' | 'book1on1' | 'bts'
export type PromoteTone = 'hype' | 'calm' | 'friendly'
export type PromoteMode = 'ideas' | 'post'

export type PromoteIdea = { title: string; angle: string }
export type PromotePost = {
  hook: string
  caption: string
  hashtags: string[]
  cta: string
  videoScript: string[] | null
}

export type PromoteInput = {
  kind: PromoteKind
  discipline?: string | null
  topic?: string | null
  tone?: PromoteTone | null
  mode: PromoteMode
}

export type PromoteOutcome =
  | { mode: 'ideas'; ideas: PromoteIdea[] }
  | { mode: 'post'; post: PromotePost }

const KIND_LABELS: Record<PromoteKind, string> = {
  class: 'a group class or open session (fill seats)',
  workout: 'a workout, drill, or technique tip (show expertise)',
  book1on1: 'booking a 1-on-1 coaching slot (drive enquiries)',
  bts: 'a behind-the-scenes / trust-building post (build the relationship)',
}

const TONE_GUIDE: Record<PromoteTone, string> = {
  hype: 'energetic and motivating, but never spammy or salesy',
  calm: 'calm, grounded, and reassuring',
  friendly: 'warm, friendly, and conversational',
}

/** Tolerant JSON extraction — Claude occasionally wraps JSON in prose or fences. */
function parseJson(text: string): Record<string, unknown> {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(stripped) as Record<string, unknown>
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('no JSON object found in model response')
    return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>
  }
}

function buildSystem(discipline: string, tone: PromoteTone): string {
  return `You write Instagram and Facebook posts for a local ${discipline} coach. Voice: ${TONE_GUIDE[tone]}. Write like a real person, not a marketer — confident, warm, and grounded in a real local community. Minimal emoji (0–2 max). No hashtag spam, no "DM me 🔥🔥🔥" clichés, no fake urgency. Speak to real people in the coach's town who might train with them.
Return ONLY valid JSON — no prose, no markdown, no code fences.`
}

async function generateText(
  client: Anthropic,
  system: string,
  userMsg: string,
  maxTokens: number
): Promise<string> {
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMsg }],
  })
  let text = ''
  for (const block of resp.content) if (block.type === 'text') text += block.text
  return text
}

export async function runPromoteGeneration(input: PromoteInput): Promise<PromoteOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const client = new Anthropic({ apiKey })

  const tone = input.tone ?? 'friendly'
  const discipline = (input.discipline ?? '').trim() || 'fitness / martial arts'
  const kindLabel = KIND_LABELS[input.kind]
  const topic = (input.topic ?? '').trim()
  const system = buildSystem(discipline, tone)

  if (input.mode === 'ideas') {
    const userMsg =
      `Give the coach 5 distinct post ideas for ${kindLabel}.` +
      (topic ? `\nWhat they're promoting: ${topic}` : '') +
      `\n\nReturn JSON: {"ideas":[{"title":"short punchy label","angle":"one sentence on the hook/angle"}]} with exactly 5 ideas.`
    const text = await generateText(client, system, userMsg, 1024)
    const parsed = parseJson(text)
    const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : []
    const ideas: PromoteIdea[] = []
    for (const r of rawIdeas) {
      if (!r || typeof r !== 'object') continue
      const o = r as Record<string, unknown>
      const title = typeof o.title === 'string' ? o.title.trim() : ''
      const angle = typeof o.angle === 'string' ? o.angle.trim() : ''
      if (title || angle) ideas.push({ title: title || angle.slice(0, 48), angle })
      if (ideas.length >= 5) break
    }
    return { mode: 'ideas', ideas }
  }

  // mode: 'post' — a video script only makes sense for technique/BTS content.
  const wantScript = input.kind === 'workout' || input.kind === 'bts'
  const userMsg =
    `Write ONE Instagram/Facebook post for ${kindLabel}.` +
    (topic ? `\nWhat they're promoting: ${topic}` : '') +
    `\n\nReturn JSON:\n{"hook":"a scroll-stopping first line","caption":"the full caption, 2-5 short paragraphs with line breaks","hashtags":["8-12 relevant tags, mostly local, no # prefix"],"cta":"one clear call to action"` +
    (wantScript
      ? `,"videoScript":["3-6 short shot or line directions for a 15-30s Reel"]}`
      : `,"videoScript":null}`)
  const text = await generateText(client, system, userMsg, 1536)
  const parsed = parseJson(text)

  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags
        .filter((h): h is string => typeof h === 'string')
        .map((h) => h.replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, 15)
    : []
  const scriptRaw = Array.isArray(parsed.videoScript)
    ? parsed.videoScript
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const post: PromotePost = {
    hook: typeof parsed.hook === 'string' ? parsed.hook.trim() : '',
    caption: typeof parsed.caption === 'string' ? parsed.caption.trim() : '',
    hashtags,
    cta: typeof parsed.cta === 'string' ? parsed.cta.trim() : '',
    videoScript: scriptRaw.length ? scriptRaw : null,
  }
  return { mode: 'post', post }
}
