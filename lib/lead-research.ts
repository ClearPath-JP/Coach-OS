import Anthropic from '@anthropic-ai/sdk'

/**
 * One result entry the UI renders. Kept loose because what Claude finds
 * varies a lot across query types.
 */
export type LeadResult = {
  name: string
  platform: 'instagram' | 'website' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube' | 'other'
  handle: string | null
  url: string
  email: string | null
  bio: string | null
  followers: number | null
}

/**
 * Pricing for claude-sonnet-4-6 (per 1M tokens) — approximate.
 * Used to estimate cost_cents for the search.
 */
const INPUT_COST_PER_MTOK_CENTS = 300 // $3.00 / 1M
const OUTPUT_COST_PER_MTOK_CENTS = 1500 // $15.00 / 1M
const WEB_SEARCH_COST_PER_QUERY_CENTS = 1 // $10 / 1K queries

const SYSTEM_PROMPT = `You are a research assistant helping a fitness/martial-arts coach find potential clients in their area.

Use web_search to find people or businesses matching the user's query. For each, gather publicly available information ONLY — do not invent details. If a contact method isn't publicly visible, leave it null.

When you have enough results (target 5-10), respond with ONLY a JSON object in this exact format, no surrounding text or markdown:

{
  "results": [
    {
      "name": "Display name or handle",
      "platform": "instagram" | "website" | "facebook" | "linkedin" | "twitter" | "tiktok" | "youtube" | "other",
      "handle": "@username or null",
      "url": "https://full-public-url",
      "email": "publicly-visible@email.com or null",
      "bio": "One sentence about who they are or null",
      "followers": 12500 or null
    }
  ]
}

Rules:
- Only include people/businesses whose public info you actually verified via search
- Skip anyone whose URL you can't confirm
- bio should be ONE concise sentence (max 120 chars)
- platform is required and lowercased
- Do not add any text before or after the JSON object`

export type LeadSearchOutcome = {
  results: LeadResult[]
  costCents: number
  inputTokens: number
  outputTokens: number
  webSearchCalls: number
}

export async function runLeadResearch(query: string): Promise<LeadSearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      } as unknown as Anthropic.Messages.Tool,
    ],
    messages: [{ role: 'user', content: query }],
  })

  // Pull the final text block (after any tool_use blocks)
  let finalText = ''
  let webSearchCalls = 0
  for (const block of response.content) {
    if (block.type === 'text') {
      finalText += block.text
    } else if (block.type === 'server_tool_use' || (block as { type: string }).type === 'tool_use') {
      const name = (block as { name?: string }).name
      if (name === 'web_search') webSearchCalls += 1
    } else if ((block as { type: string }).type === 'web_search_tool_result') {
      // Result block from server-side web search — counts as a use
      // (already counted on the tool_use side, but be defensive)
    }
  }

  let results: LeadResult[] = []
  try {
    const trimmed = finalText.trim()
    // Strip markdown code fence if Claude wraps it despite instructions
    const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(stripped) as { results?: unknown }
    if (Array.isArray(parsed.results)) {
      results = parsed.results
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) => normalizeResult(r))
        .filter((r): r is LeadResult => r !== null)
    }
  } catch {
    // Leave results empty; caller will mark status failed
    results = []
  }

  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  const tokenCostCents =
    (inputTokens * INPUT_COST_PER_MTOK_CENTS) / 1_000_000 +
    (outputTokens * OUTPUT_COST_PER_MTOK_CENTS) / 1_000_000
  const webSearchCostCents = webSearchCalls * WEB_SEARCH_COST_PER_QUERY_CENTS
  const costCents = Math.ceil(tokenCostCents + webSearchCostCents)

  return { results, costCents, inputTokens, outputTokens, webSearchCalls }
}

function normalizeResult(raw: Record<string, unknown>): LeadResult | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  if (!name || !url) return null

  const platformRaw = typeof raw.platform === 'string' ? raw.platform.toLowerCase().trim() : 'other'
  const platform = (
    ['instagram', 'website', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'].includes(platformRaw)
      ? platformRaw
      : 'other'
  ) as LeadResult['platform']

  return {
    name,
    platform,
    handle: typeof raw.handle === 'string' && raw.handle.trim() ? raw.handle.trim() : null,
    url,
    email: typeof raw.email === 'string' && raw.email.includes('@') ? raw.email.trim() : null,
    bio: typeof raw.bio === 'string' && raw.bio.trim() ? raw.bio.trim().slice(0, 200) : null,
    followers: typeof raw.followers === 'number' && raw.followers >= 0 ? Math.floor(raw.followers) : null,
  }
}
