/**
 * Per-workspace daily spend ceilings for money-spending routes
 * (Anthropic / Apify / AWS Lambda).
 *
 * Uses the same Upstash Redis instance as lib/rate-limit.ts.
 * Fixed-window counter keyed by UTC date: spend:<action>:<workspaceId>:<YYYY-MM-DD>.
 *
 * Fail behaviour:
 *   - production + Redis unavailable → fail CLOSED (block spend, return allowed:false)
 *   - non-production or missing config → fail OPEN (allow, so local dev isn't blocked)
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export type SpendAction = 'render' | 'ai_generate' | 'ai_chat' | 'lead_search' | 'lead_outreach'

export type SpendQuotaResult = { allowed: boolean; used: number; max: number }

/**
 * Per-workspace daily cap for money-spending actions (Anthropic/Apify/AWS Lambda).
 * Redis INCR on a per-UTC-day key with ~25h TTL. Fails CLOSED in production if Redis is
 * unavailable (this guards real spend); allows in dev so local testing isn't blocked.
 */
export async function checkDailyWorkspaceQuota(
  workspaceId: string,
  action: SpendAction,
  maxPerDay: number
): Promise<SpendQuotaResult> {
  const utcDate = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  const key = `spend:${action}:${workspaceId}:${utcDate}`

  if (!REDIS_URL?.trim() || !REDIS_TOKEN?.trim()) {
    // No Redis configured — fail CLOSED in production, open elsewhere.
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[ClearPath] spend-guard: UPSTASH_REDIS_REST_URL / _TOKEN not set — failing CLOSED to protect spend.'
      )
      return { allowed: false, used: 0, max: maxPerDay }
    }
    return { allowed: true, used: 0, max: maxPerDay }
  }

  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN })

    // INCR is atomic; returns the new value after increment.
    const count = (await redis.incr(key)) as number

    // Only set expiry on the first hit to avoid resetting it on every request.
    if (count === 1) {
      // ~25h so the key outlives the UTC day by an hour, then auto-cleans.
      await redis.expire(key, 90_000)
    }

    return { allowed: count <= maxPerDay, used: count, max: maxPerDay }
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[ClearPath] spend-guard: Redis call failed — failing CLOSED.', err)
      return { allowed: false, used: 0, max: maxPerDay }
    }
    // Non-production: allow so local development isn't blocked.
    return { allowed: true, used: 0, max: maxPerDay }
  }
}
