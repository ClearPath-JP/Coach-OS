import Anthropic from '@anthropic-ai/sdk'

/** One result entry the UI renders. */
export type LeadType = 'individual' | 'partner' | 'influencer' | 'business'

export type LeadResult = {
  name: string
  leadType: LeadType
  reason: string | null
  platform: 'instagram' | 'website' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube' | 'other'
  handle: string | null
  url: string
  email: string | null
  bio: string | null
  followers: number | null
}

// --- Cost model ---
const INPUT_COST_PER_MTOK_CENTS = 300 // claude-sonnet-4-6 ≈ $3.00 / 1M
const OUTPUT_COST_PER_MTOK_CENTS = 1500 // ≈ $15.00 / 1M
const APIFY_COST_PER_RESULT_CENTS = 0.19 // apify/instagram-hashtag-scraper: $1.90 / 1,000 results

// --- Tuning ---
const APIFY_ACTOR = 'apify~instagram-hashtag-scraper'
const RESULTS_PER_HASHTAG = 20 // posts pulled per hashtag → bounds Apify cost
const MAX_HASHTAGS = 6 // hashtags we crawl per search
const MAX_APIFY_ITEMS = MAX_HASHTAGS * RESULTS_PER_HASHTAG // hard cap on charged Apify results
const MAX_CANDIDATES_TO_CLASSIFY = 80 // bounds the Claude classify input
const MAX_PARTNERS_AND_BUSINESS = 3 // individuals must dominate the list

// Known disciplines → strong Instagram hashtags (the form is free-text, so fall back to a slug).
const DISCIPLINE_HASHTAGS: Record<string, string[]> = {
  'brazilian jiu-jitsu': ['bjj', 'jiujitsu'],
  'jiu-jitsu': ['bjj', 'jiujitsu'],
  bjj: ['bjj', 'jiujitsu'],
  boxing: ['boxing', 'boxingtraining'],
  'muay thai': ['muaythai'],
  mma: ['mma'],
  wrestling: ['wrestling'],
  judo: ['judo'],
  karate: ['karate'],
  taekwondo: ['taekwondo'],
  'karate / taekwondo': ['karate', 'taekwondo'],
  'strength & conditioning': ['strengthtraining', 'strengthandconditioning'],
  'personal training': ['personaltrainer', 'personaltraining'],
  'weight-loss coaching': ['weightlossjourney'],
  crossfit: ['crossfit'],
  yoga: ['yoga'],
}

// Ideal-client chips → intent hashtags.
const INTENT_HASHTAGS: Record<string, string[]> = {
  beginners: ['fitnessjourney'],
  'weight loss': ['weightlossjourney'],
  'kids / teens': ['kidsfitness'],
  women: ['womensfitness'],
  seniors: ['seniorfitness'],
  athletes: [],
  competitors: [],
  'busy professionals': [],
}

export type LeadSearchOptions = {
  discipline?: string | null
  area?: string | null
  idealClients?: string[] | null
  platform?: string | null
}

export type LeadSearchOutcome = {
  results: LeadResult[]
  costCents: number
  inputTokens: number
  outputTokens: number
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** "Marietta, GA" → "marietta" */
function cityFromArea(area: string): string {
  return slugify(area.split(',')[0] ?? area)
}

/**
 * Deterministic fallback hashtags from the coach's structured inputs — used when the
 * Claude hashtag planner is unavailable or returns too few.
 */
function buildHashtags(opts: LeadSearchOptions): string[] {
  const city = opts.area ? cityFromArea(opts.area) : ''
  const disc = (opts.discipline ?? '').toLowerCase().trim()
  const discTags = DISCIPLINE_HASHTAGS[disc] ?? (disc ? [slugify(disc)] : [])
  const intentTags = (opts.idealClients ?? []).flatMap(
    (c) => INTENT_HASHTAGS[c.toLowerCase().trim()] ?? []
  )

  const ordered: string[] = []
  if (city) {
    // City-anchored tags ONLY — these surface LOCAL people. Bare discipline tags
    // (#bjj, #jiujitsu) are global and drag in non-local accounts (e.g. overseas
    // athletes), so we deliberately omit them.
    ordered.push(city, `${city}fitness`, `${city}gym`)
    for (const d of discTags) ordered.push(`${city}${d}`)
  } else {
    // No usable city — fall back to bare discipline/intent tags (less precise).
    ordered.push(...discTags, ...intentTags)
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ordered) {
    const tag = raw.replace(/^#/, '').trim()
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
    }
    if (out.length >= MAX_HASHTAGS) break
  }
  return out
}

const HASHTAG_SYSTEM = `You know US local geography and Instagram hashtag conventions. Given a coach's discipline, area, and ideal clients, output Instagram hashtags that surface LOCAL people in or near that area.

Blend: the specific city, its neighborhoods/county, the surrounding metro, and 1–2 discipline- or fitness-tags anchored to the locale. Example for "Marietta, GA": ["marietta","mariettafitness","eastcobb","cobbcounty","atlantafitness","atlantabjj"].

Rules:
- EVERY tag must encode a PLACE (city / neighborhood / county / metro). NEVER output bare global tags like "bjj", "fitness", or "weightloss" — those pull worldwide accounts.
- lowercase, no '#', no spaces, letters and numbers only.
- 6–8 tags, most-populated / most-useful first.
Respond with ONLY JSON: {"hashtags":["...","..."]}`

/**
 * Ask Claude for locale-aware hashtags (it knows a city's neighborhoods + metro).
 * Falls back to the deterministic slug tags if the call fails or returns too few.
 */
async function planHashtags(
  client: Anthropic,
  opts: LeadSearchOptions
): Promise<{ hashtags: string[]; inputTokens: number; outputTokens: number }> {
  const fallback = buildHashtags(opts)
  if (!opts.area) return { hashtags: fallback, inputTokens: 0, outputTokens: 0 }
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: HASHTAG_SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `Discipline: ${opts.discipline ?? 'fitness'}\n` +
            `Area: ${opts.area}\n` +
            `Ideal clients: ${(opts.idealClients ?? []).join(', ') || 'anyone local'}`,
        },
      ],
    })
    let text = ''
    for (const b of resp.content) if (b.type === 'text') text += b.text
    const parsed = parseResultsJson(text)
    const raw = Array.isArray(parsed.hashtags) ? parsed.hashtags : []

    const seen = new Set<string>()
    const tags: string[] = []
    for (const t of raw) {
      if (typeof t !== 'string') continue
      const tag = slugify(t)
      if (tag && !seen.has(tag)) {
        seen.add(tag)
        tags.push(tag)
      }
      if (tags.length >= MAX_HASHTAGS) break
    }
    // Too few from the model — top up with the deterministic fallback.
    if (tags.length < 3) {
      for (const f of fallback) {
        if (!seen.has(f)) {
          seen.add(f)
          tags.push(f)
        }
        if (tags.length >= MAX_HASHTAGS) break
      }
    }
    return {
      hashtags: tags.length ? tags : fallback,
      inputTokens: resp.usage?.input_tokens ?? 0,
      outputTokens: resp.usage?.output_tokens ?? 0,
    }
  } catch {
    return { hashtags: fallback, inputTokens: 0, outputTokens: 0 }
  }
}

// --- Apify scrape ---
type ApifyPost = {
  ownerUsername?: string
  ownerFullName?: string
  owner?: { username?: string; fullName?: string } | null
  caption?: string
  url?: string
  locationName?: string
  location?: { name?: string } | null
}

async function scrapeInstagramHashtags(hashtags: string[]): Promise<ApifyPost[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not configured')
  if (hashtags.length === 0) return []

  const endpoint =
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
    `?maxItems=${MAX_APIFY_ITEMS}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ hashtags, resultsLimit: RESULTS_PER_HASHTAG }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Apify scrape failed (${res.status}): ${body.slice(0, 200)}`)
    }
    const data = (await res.json()) as unknown
    return Array.isArray(data) ? (data as ApifyPost[]).slice(0, MAX_APIFY_ITEMS) : []
  } finally {
    clearTimeout(timer)
  }
}

type Candidate = {
  username: string
  fullName: string
  caption: string
  location: string
}

/** Collapse scraped posts to one row per unique author. */
function toCandidates(posts: ApifyPost[]): Candidate[] {
  const byUser = new Map<string, Candidate>()
  for (const p of posts) {
    const username = (p.ownerUsername ?? p.owner?.username ?? '').trim()
    if (!username || byUser.has(username)) continue
    byUser.set(username, {
      username,
      fullName: (p.ownerFullName ?? p.owner?.fullName ?? '').trim(),
      caption: (p.caption ?? '').replace(/\s+/g, ' ').slice(0, 280),
      location: (p.locationName ?? p.location?.name ?? '').trim(),
    })
  }
  return [...byUser.values()]
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

// --- Claude classification ---
const CLASSIFY_SYSTEM = `You are helping a local fitness or martial-arts coach turn a list of scraped Instagram accounts into actionable leads.

You'll get the coach's discipline + area, then a JSON array of accounts (username, name, a recent caption, and any location tag). Classify each account:
- "individual": a REAL LOCAL PERSON (not a business, brand, or gym) who could plausibly become a coaching client — anyone local showing interest in fitness, training, weight loss, an active lifestyle, or trying the discipline. They do NOT need to be posting an explicit "journey"; a regular local person who works out, plays a sport, or clearly wants to get in shape counts. THIS IS THE PRIORITY — be generous here.
- "influencer": a content creator / clearly a personal brand (big following, "coach/creator" energy).
- "partner": a complementary local business for referrals — a gym/studio that does NOT teach the coach's discipline, a physio, a nutritionist.
- "business": any other relevant local organization.

DROP an account entirely (do not return it) if it is:
- a DIRECT COMPETITOR (a gym/academy/coach teaching the SAME discipline in the area),
- a national chain/franchise, a product/supplement brand, or a spam/bot/giveaway account,
- clearly not local to the coach's area, or not plausibly relevant.

LOCALITY IS CRITICAL: the coach can only train people near their area. If an account's caption, location tag, or name shows they're based in a DIFFERENT city, state, or country (e.g. an athlete repping another country, or posts tagged abroad), DROP it — a non-local person is useless to the coach even if they do the right sport.

For each KEPT account return: the username EXACTLY as given, a display "name" (their real name if present, else the username), "leadType", and a "reason" — ONE sentence (max 120 chars) on why they're worth reaching out to + the angle.

Respond with ONLY this JSON, no prose:
{ "results": [ { "username": "...", "name": "...", "leadType": "individual|influencer|partner|business", "reason": "..." } ] }

Return EVERY plausible local individual you find — aim for up to 10. Be generous: better to surface a maybe-prospect than miss a real one. Only limit partners/businesses to the best few. Still DROP competitors, national chains, spam, and clearly non-local accounts.`

type ClassifiedRaw = { username?: unknown; name?: unknown; leadType?: unknown; reason?: unknown }

function parseResultsJson(text: string): Record<string, unknown> {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(stripped) as Record<string, unknown>
  } catch {
    // Tolerate prose-wrapped JSON by grabbing the outermost object.
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('no JSON object found in model response')
    return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>
  }
}

function coerceLeadType(v: unknown): LeadType {
  const s = typeof v === 'string' ? v.toLowerCase().trim() : ''
  return (['individual', 'partner', 'influencer', 'business'].includes(s) ? s : 'individual') as LeadType
}

/**
 * Pipeline: Claude plans local hashtags → scrape Instagram via Apify → Claude classifies
 * the real scraped authors into leads. Result URLs are built from the actual scraped
 * usernames, so there's no hallucinated-link risk.
 */
export async function runLeadResearch(
  _query: string,
  opts: LeadSearchOptions = {}
): Promise<LeadSearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const client = new Anthropic({ apiKey })

  // Claude plans locale-aware hashtags (knows the city's neighborhoods + metro).
  const plan = await planHashtags(client, opts)
  const hashtags = plan.hashtags
  const posts = await scrapeInstagramHashtags(hashtags)
  const candidates = toCandidates(posts)
  const apifyCostCents = posts.length * APIFY_COST_PER_RESULT_CENTS

  if (candidates.length === 0) {
    const planCostCents =
      (plan.inputTokens * INPUT_COST_PER_MTOK_CENTS) / 1_000_000 +
      (plan.outputTokens * OUTPUT_COST_PER_MTOK_CENTS) / 1_000_000
    return {
      results: [],
      costCents: Math.ceil(apifyCostCents + planCostCents),
      inputTokens: plan.inputTokens,
      outputTokens: plan.outputTokens,
    }
  }

  const compact = candidates.slice(0, MAX_CANDIDATES_TO_CLASSIFY).map((c) => ({
    username: c.username,
    name: c.fullName,
    caption: c.caption,
    location: c.location,
  }))
  const idealClients = (opts.idealClients ?? []).filter(Boolean).join(', ')
  const userMsg =
    `Coach discipline: ${opts.discipline ?? 'fitness'}\n` +
    `Coach area: ${opts.area ?? 'local'}\n` +
    (idealClients ? `Ideal clients to prioritise: ${idealClients}\n` : '') +
    `\nAccounts:\n${JSON.stringify(compact)}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  let finalText = ''
  for (const block of response.content) {
    if (block.type === 'text') finalText += block.text
  }

  // Map classifications back onto the real scraped accounts.
  const byUser = new Map(candidates.map((c) => [c.username.toLowerCase(), c]))
  let results: LeadResult[] = []
  try {
    const parsed = parseResultsJson(finalText)
    if (Array.isArray(parsed.results)) {
      for (const r of parsed.results as ClassifiedRaw[]) {
        const username = typeof r.username === 'string' ? r.username.trim().replace(/^@/, '') : ''
        const cand = byUser.get(username.toLowerCase())
        if (!cand) continue // drop anything that doesn't map to a real scraped account
        const email = cand.caption.match(EMAIL_RE)?.[0] ?? null
        const name =
          typeof r.name === 'string' && r.name.trim() ? r.name.trim() : cand.fullName || username
        results.push({
          name,
          leadType: coerceLeadType(r.leadType),
          reason:
            typeof r.reason === 'string' && r.reason.trim() ? r.reason.trim().slice(0, 160) : null,
          platform: 'instagram',
          handle: `@${username}`,
          url: `https://www.instagram.com/${username}/`,
          email,
          bio: null,
          followers: null,
        })
      }
    }
  } catch {
    results = []
  }

  results = capBusinesses(results)

  const inputTokens = (response.usage?.input_tokens ?? 0) + plan.inputTokens
  const outputTokens = (response.usage?.output_tokens ?? 0) + plan.outputTokens
  const tokenCostCents =
    (inputTokens * INPUT_COST_PER_MTOK_CENTS) / 1_000_000 +
    (outputTokens * OUTPUT_COST_PER_MTOK_CENTS) / 1_000_000
  const costCents = Math.ceil(apifyCostCents + tokenCostCents)

  return { results, costCents, inputTokens, outputTokens }
}

/** Keep individuals/influencers; cap partners + businesses so they can't dominate. */
function capBusinesses(results: LeadResult[]): LeadResult[] {
  const primary = results.filter((r) => r.leadType === 'individual' || r.leadType === 'influencer')
  const secondary = results
    .filter((r) => r.leadType === 'partner' || r.leadType === 'business')
    .slice(0, MAX_PARTNERS_AND_BUSINESS)
  return [...primary, ...secondary]
}
