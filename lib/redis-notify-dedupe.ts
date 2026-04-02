/**
 * Dedupe outbound coach email notifications (e.g. one per client thread per 30 minutes).
 * Uses Upstash Redis SET NX when configured; otherwise in-memory TTL (dev / tests).
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const memoryTtl = new Map<string, number>()

function tryMemoryDedupe(key: string, ttlSeconds: number): boolean {
  const now = Date.now()
  const exp = memoryTtl.get(key)
  if (exp !== undefined && exp > now) return false
  memoryTtl.set(key, now + ttlSeconds * 1000)
  return true
}

/**
 * @returns true if this is the first send in the window (caller should send); false to skip.
 */
export async function tryAcquireNotifyDedupeKey(key: string, ttlSeconds: number): Promise<boolean> {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis')
      const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
      const ok = await redis.set(key, '1', { ex: ttlSeconds, nx: true })
      return ok === 'OK'
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.error('notify dedupe redis error', e)
        return false
      }
      return tryMemoryDedupe(key, ttlSeconds)
    }
  }
  return tryMemoryDedupe(key, ttlSeconds)
}
