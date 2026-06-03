import Anthropic from '@anthropic-ai/sdk'

/**
 * Promote content studio engine.
 * Three brains, all on claude-sonnet-4-6, all stateless:
 *  - generation: post ideas, a full post, or a video plan (mode: ideas | post | video)
 *  - chat: a back-and-forth partner that helps a coach shape a post in their own voice
 * Content tools are available on ALL plans (no gating).
 */

export type PromoteKind = 'class' | 'workout' | 'book1on1' | 'bts'
export type PromoteTone = 'hype' | 'calm' | 'friendly'
export type PromoteMode = 'ideas' | 'post' | 'video'

export type PromoteIdea = { title: string; angle: string }
export type PromotePost = {
  hook: string
  caption: string
  hashtags: string[]
  cta: string
  videoScript: string[] | null
}
export type VideoPlan = {
  hookIdea: string
  structure: string[]
  onScreenText: string[]
  caption: string
  hashtags: string[]
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
  | { mode: 'video'; videoPlan: VideoPlan }

export type ChatRole = 'user' | 'assistant'
export type ChatMessage = { role: ChatRole; content: string }
export type ChatContext = { discipline?: string | null; tone?: PromoteTone | null }
export type ChatOutcome = { kind: 'reply'; reply: string } | { kind: 'post'; post: PromotePost }

const MODEL = 'claude-sonnet-4-6'

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

function strArray(v: unknown, max = 15): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function buildSystem(discipline: string, tone: PromoteTone): string {
  return `You write Instagram and Facebook posts for a local ${discipline} coach. Voice: ${TONE_GUIDE[tone]}. Write like a real person, not a marketer — confident, warm, and grounded in a real local community. Minimal emoji (0–2 max). No hashtag spam, no "DM me 🔥🔥🔥" clichés, no fake urgency. Speak to real people in the coach's town who might train with them.
Never output bracketed placeholders like [YourTown], [City], [Town], or [YourCity] anywhere in the output — especially in hashtags. You do not know the coach's city. Use non-localized tags instead (e.g. #brazilianjiujitsu #bjjlife #martialarts) rather than inventing a [placeholder]. If the coach's location appears in the provided topic or discipline text, you may use that real place name, but never a bracketed placeholder.
Return ONLY valid JSON — no prose, no markdown, no code fences.`
}

/** Build a PromotePost from a parsed JSON object (shared by post mode + chat finalize). */
function parsePost(parsed: Record<string, unknown>): PromotePost {
  const hashtags = strArray(parsed.hashtags).map((h) => h.replace(/^#/, '')).filter(Boolean)
  const script = strArray(parsed.videoScript)
  return {
    hook: str(parsed.hook),
    caption: str(parsed.caption),
    hashtags,
    cta: str(parsed.cta),
    videoScript: script.length ? script : null,
  }
}

async function generateText(
  client: Anthropic,
  system: string,
  userMsg: string,
  maxTokens: number
): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMsg }],
  })
  let text = ''
  for (const block of resp.content) if (block.type === 'text') text += block.text
  return text
}

function makeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey })
}

export async function runPromoteGeneration(input: PromoteInput): Promise<PromoteOutcome> {
  const client = makeClient()
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
    const parsed = parseJson(await generateText(client, system, userMsg, 1024))
    const ideas: PromoteIdea[] = []
    for (const r of Array.isArray(parsed.ideas) ? parsed.ideas : []) {
      if (!r || typeof r !== 'object') continue
      const o = r as Record<string, unknown>
      const title = str(o.title)
      const angle = str(o.angle)
      if (title || angle) ideas.push({ title: title || angle.slice(0, 48), angle })
      if (ideas.length >= 5) break
    }
    return { mode: 'ideas', ideas }
  }

  if (input.mode === 'video') {
    const userMsg =
      `The coach has a short video clip to post as a Reel / Short.` +
      (topic
        ? `\nWhat the clip shows: ${topic}`
        : `\nThey haven't described the clip — infer a sensible plan for a ${discipline} coach.`) +
      `\n\nReturn JSON:\n{"hookIdea":"what to show or say in the first 2 seconds to stop the scroll","structure":["3-6 shot-by-shot directions for how to cut/structure the clip"],"onScreenText":["3-6 short on-screen caption lines to overlay, in order"],"caption":"the post caption, 2-4 short paragraphs with line breaks","hashtags":["8-12 non-localized discipline tags, no # prefix, no bracketed placeholders"]}`
    const parsed = parseJson(await generateText(client, system, userMsg, 1536))
    const videoPlan: VideoPlan = {
      hookIdea: str(parsed.hookIdea),
      structure: strArray(parsed.structure),
      onScreenText: strArray(parsed.onScreenText),
      caption: str(parsed.caption),
      hashtags: strArray(parsed.hashtags).map((h) => h.replace(/^#/, '')).filter(Boolean),
    }
    return { mode: 'video', videoPlan }
  }

  // mode: 'post' — a video script only makes sense for technique/BTS content.
  const wantScript = input.kind === 'workout' || input.kind === 'bts'
  const userMsg =
    `Write ONE Instagram/Facebook post for ${kindLabel}.` +
    (topic ? `\nWhat they're promoting: ${topic}` : '') +
    `\n\nReturn JSON:\n{"hook":"a scroll-stopping first line","caption":"the full caption, 2-5 short paragraphs with line breaks","hashtags":["8-12 non-localized discipline tags, no # prefix, no bracketed placeholders"],"cta":"one clear call to action"` +
    (wantScript
      ? `,"videoScript":["3-6 short shot or line directions for a 15-30s Reel"]}`
      : `,"videoScript":null}`)
  const parsed = parseJson(await generateText(client, system, userMsg, 1536))
  return { mode: 'post', post: parsePost(parsed) }
}

const CHAT_MAX_TURNS = 24

/**
 * Conversational partner. When finalize=false, returns a short conversational reply
 * that draws out the coach's thinking. When finalize=true, turns the whole
 * conversation into a finished post in the coach's own voice.
 */
export async function runPromoteChat(
  messages: ChatMessage[],
  ctx: ChatContext,
  finalize: boolean
): Promise<ChatOutcome> {
  const client = makeClient()
  const tone = ctx.tone ?? 'friendly'
  const discipline = (ctx.discipline ?? '').trim() || 'martial arts / fitness'

  // Anthropic requires the turn list to start with a user message and alternate.
  const trimmed = messages.slice(-CHAT_MAX_TURNS)
  const firstUser = trimmed.findIndex((m) => m.role === 'user')
  const clean = firstUser === -1 ? [] : trimmed.slice(firstUser)

  if (!finalize) {
    const system = `You are a warm, sharp content partner for a local ${discipline} coach. You help them think out loud about their coaching philosophy, a student, a technique, or a story, and shape it into a social post that sounds like THEM — not like marketing. Voice: ${TONE_GUIDE[tone]}.
Ask ONE good question at a time. Reflect their words back. Keep replies short (2–4 sentences). When they've given you enough to work with, tell them they can tap "Create the post" whenever they're ready.`
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system,
      messages: clean.map((m) => ({ role: m.role, content: m.content })),
    })
    let reply = ''
    for (const b of resp.content) if (b.type === 'text') reply += b.text
    return { kind: 'reply', reply: reply.trim() }
  }

  // finalize → write the post from the conversation
  const convo = clean.map((m) => `${m.role === 'user' ? 'Coach' : 'Partner'}: ${m.content}`).join('\n')
  const system =
    buildSystem(discipline, tone) +
    `\nUse the coach's own words and ideas from the conversation. Keep their voice.`
  const userMsg =
    `Here is my conversation with the coach:\n\n${convo}\n\n` +
    `Write ONE Instagram/Facebook post in the coach's voice based on what they said. ` +
    `Return JSON:\n{"hook":"scroll-stopping first line","caption":"full caption, 2-5 short paragraphs with line breaks","hashtags":["8-12 non-localized discipline tags, no #, no bracketed placeholders"],"cta":"one clear call to action","videoScript":null}`
  const parsed = parseJson(await generateText(client, system, userMsg, 1536))
  return { kind: 'post', post: parsePost(parsed) }
}
