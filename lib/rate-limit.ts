/**
 * Rate limiting for middleware and API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 * Without it (or if the Upstash call fails): dev allows all; in prod, fail-open routes allow
 * and fail-closed (money) routes degrade to a per-instance in-memory limiter — never a hard block.
 *
 * If you use Upstash locally and hit 429s while testing, set CLEARPATH_DEV_DISABLE_RATE_LIMIT=1
 * (non-production only) or temporarily comment out the UPSTASH_* vars.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let warnedMissingRedis = false
let warnedRedisCallFailed = false

/**
 * Fixed-window counters used by (a) Jest integration tests and (b) the production
 * fail-closed fallback when Upstash is unreachable. Per-instance (not distributed).
 */
const memoryBuckets = new Map<string, { count: number; resetAt: number }>()
let lastBucketSweep = 0

/** Drop expired buckets (at most once/min) so the fallback can't grow unbounded on long-lived instances. */
function sweepExpiredBuckets(now: number) {
  if (now - lastBucketSweep < 60_000) return
  lastBucketSweep = now
  for (const [k, b] of memoryBuckets) {
    if (now >= b.resetAt) memoryBuckets.delete(k)
  }
}

function checkInMemory(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  sweepExpiredBuckets(now)
  let bucket = memoryBuckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + options.windowMs }
    memoryBuckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > options.max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return { success: false, retryAfter }
  }
  return { success: true }
}

export type RateLimitOptions = {
  windowMs: number
  max: number
  /** What to do if the limiter backend is unavailable. 'open' = allow (default, for auth/generic routes); 'closed' = block (use for money-spending routes). */
  failMode?: 'open' | 'closed'
}

export type RateLimitResult = {
  success: boolean
  retryAfter?: number
}

async function checkWithUpstash(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    })
    const windowSeconds = Math.ceil(options.windowMs / 1000)
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.max, `${windowSeconds} s`),
    })
    const { success, reset } = await ratelimit.limit(key)
    if (success) return { success: true }
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return { success: false, retryAfter: Math.max(1, retryAfter) }
  } catch (error) {
    const failClosed = options.failMode === 'closed'
    if (process.env.NODE_ENV === 'production' && !warnedRedisCallFailed) {
      warnedRedisCallFailed = true
      console.error(
        `[ClearPath] Upstash rate limit call failed — ${failClosed ? 'degrading to in-memory limiter (per-instance)' : 'failing OPEN (allowing)'}. Check URL, token, and Upstash dashboard.`,
        error
      )
    }
    // Backend unreachable: fail-open routes allow; fail-closed routes degrade to a
    // per-instance in-memory limiter (still caps abuse) instead of blocking everything.
    return failClosed ? checkInMemory(key, options) : { success: true }
  }
}

/**
 * Async rate limit check for use in middleware and API routes.
 * 11-auth: /login, /forgot-password — 30 requests/min per IP.
 */
export async function checkRateLimitAsync(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.CLEARPATH_DEV_DISABLE_RATE_LIMIT === '1'
  ) {
    return { success: true }
  }
  if (process.env.CLEARPATH_TEST_RATE_LIMIT === '1') {
    return checkInMemory(key, options)
  }
  if (!REDIS_URL?.trim() || !REDIS_TOKEN?.trim()) {
    if (process.env.NODE_ENV === 'production' && !warnedMissingRedis) {
      warnedMissingRedis = true
      console.error('[ClearPath] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set — fail-closed routes use a per-instance in-memory limiter; add Upstash Redis in Vercel for distributed limits.')
    }
    // Prod + fail-closed with no backend: degrade to in-memory (still limits) rather than
    // hard-blocking. Dev keeps allow-all so local testing isn't rate-limited.
    if (options.failMode === 'closed' && process.env.NODE_ENV === 'production') {
      return checkInMemory(key, options)
    }
    return { success: true }
  }
  return checkWithUpstash(key, options)
}
