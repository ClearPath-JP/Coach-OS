import type { Redis } from '@upstash/redis'
import { getUpstashRedis } from '@/lib/upstash-redis'

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const redis = await getUpstashRedis()
  if (!redis) return fn()
  try {
    const cached = await redis.get<string>(key)
    if (cached != null && cached !== '') {
      return JSON.parse(cached) as T
    }
    const result = await fn()
    await redis.set(key, JSON.stringify(result), { ex: ttlSeconds })
    return result
  } catch {
    return fn()
  }
}

async function delKeys(redis: Redis, keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const batch = keys.slice(0, 100)
  await redis.del(...batch)
  if (keys.length > 100) await delKeys(redis, keys.slice(100))
}

/** Best-effort pattern delete (SCAN). Caps iterations for serverless safety. */
async function deleteByPattern(redis: Redis, match: string): Promise<void> {
  let cursor: string | number = 0
  for (let i = 0; i < 100; i++) {
    const tuple = (await redis.scan(cursor, { match, count: 200 })) as [string, string[]]
    const nextCursor = tuple[0]
    const keys = tuple[1]
    if (keys.length > 0) await delKeys(redis, keys)
    if (nextCursor === '0') break
    cursor = nextCursor
  }
}

export function packagesCacheKey(workspaceId: string): string {
  return `cache:packages:${workspaceId}`
}

export function programsListCacheKey(workspaceId: string, status: string): string {
  return `cache:programs:${workspaceId}:${status}`
}

export function paymentsSummaryCacheKey(
  workspaceId: string,
  period: string,
  startDate: string,
  endDate: string,
  clientId: string
): string {
  return `cache:paySummary:${workspaceId}:${period}:${startDate}:${endDate}:${clientId}`
}

export function coachAnalyticsCacheKey(workspaceId: string, queryKey: string): string {
  return `cache:coachAnalytics:${workspaceId}:${queryKey}`
}

export async function invalidatePackagesCache(workspaceId: string): Promise<void> {
  const redis = await getUpstashRedis()
  if (!redis) return
  try {
    await redis.del(packagesCacheKey(workspaceId))
  } catch {
    /* ignore */
  }
}

export async function invalidateProgramsListCache(workspaceId: string): Promise<void> {
  const redis = await getUpstashRedis()
  if (!redis) return
  try {
    await deleteByPattern(redis, `cache:programs:${workspaceId}:*`)
  } catch {
    /* ignore */
  }
}

export async function invalidatePaymentSummaryCaches(workspaceId: string): Promise<void> {
  const redis = await getUpstashRedis()
  if (!redis) return
  try {
    await deleteByPattern(redis, `cache:paySummary:${workspaceId}:*`)
  } catch {
    /* ignore */
  }
}

export async function invalidateCoachAnalyticsCaches(workspaceId: string): Promise<void> {
  const redis = await getUpstashRedis()
  if (!redis) return
  try {
    await deleteByPattern(redis, `cache:coachAnalytics:${workspaceId}:*`)
  } catch {
    /* ignore */
  }
}
