/**
 * Rate limiting for middleware and API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise no limit (allow all) for local dev.
 *
 * If you use Upstash locally and hit 429s while testing, set CLEARPATH_DEV_DISABLE_RATE_LIMIT=1
 * (non-production only) or temporarily comment out the UPSTASH_* vars.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let warnedMissingRedis = false
let warnedRedisCallFailed = false

/** Fixed-window counters for Jest (no Redis) so rate-limit integration tests behave deterministically. */
const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

function checkInMemory(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
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
    if (process.env.NODE_ENV === 'production') {
      if (!warnedRedisCallFailed) {
        warnedRedisCallFailed = true
        console.error(
          '[ClearPath] Upstash rate limit call failed — failing CLOSED. Check URL, token, and Upstash dashboard.',
          error
        )
      }
      return checkInMemory(key, options)
    }
    return { success: true }
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
    if (process.env.NODE_ENV === 'production') {
      if (!warnedMissingRedis) {
        warnedMissingRedis = true
        console.error(
          '[ClearPath] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set — using in-memory rate limiting. Add Upstash Redis in Vercel for distributed limits.'
        )
      }
      return checkInMemory(key, options)
    }
    return { success: true }
  }
  return checkWithUpstash(key, options)
}
