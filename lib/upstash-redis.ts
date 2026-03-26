import type { Redis } from '@upstash/redis'

let redisSingleton: Redis | null | undefined

export async function getUpstashRedis(): Promise<Redis | null> {
  if (redisSingleton !== undefined) return redisSingleton
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) {
    redisSingleton = null
    return null
  }
  try {
    const { Redis: RedisCtor } = await import('@upstash/redis')
    redisSingleton = new RedisCtor({ url, token })
    return redisSingleton
  } catch {
    redisSingleton = null
    return null
  }
}
