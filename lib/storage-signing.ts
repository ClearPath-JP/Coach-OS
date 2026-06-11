import type { SupabaseClient } from '@supabase/supabase-js'

const PUBLIC_MARKER = '/storage/v1/object/public/'

/** Only ever mint signed URLs for our own content buckets — never an arbitrary bucket parsed
 *  from a URL. (`avatars` stays public and never needs signing.) */
const SIGNABLE_BUCKETS = new Set(['assignment-submissions', 'videos', 'studio-audio'])

/**
 * If `url` is a Supabase Storage *public* object URL, return a short-lived SIGNED URL for the
 * same object (so the bucket can be private and files aren't world-readable by URL). Non-Supabase
 * URLs (Bunny, Google Drive, external) and anything unparseable are returned unchanged.
 *
 * Signing also works on still-public buckets, and on any failure it falls back to the original
 * URL — so this is safe to deploy *before* flipping a bucket private (no broken window).
 */
export async function signSupabaseStorageUrl(
  service: SupabaseClient,
  url: string | null | undefined,
  ttlSeconds = 3600
): Promise<string | null> {
  if (!url) return url ?? null
  const idx = url.indexOf(PUBLIC_MARKER)
  if (idx === -1) return url // not a Supabase public-object URL (Bunny/Drive/external) — leave as-is

  const after = url.slice(idx + PUBLIC_MARKER.length) // "<bucket>/<path...>[?query]"
  const noQuery = after.split('?')[0] ?? after
  const slash = noQuery.indexOf('/')
  if (slash <= 0) return url

  const bucket = noQuery.slice(0, slash)
  if (!SIGNABLE_BUCKETS.has(bucket)) return url // never sign an arbitrary bucket parsed from a URL

  let path: string
  try {
    path = decodeURIComponent(noQuery.slice(slash + 1))
  } catch {
    path = noQuery.slice(slash + 1)
  }
  if (!path) return url
  if (path.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')) return url // no path traversal

  try {
    const { data, error } = await service.storage.from(bucket).createSignedUrl(path, ttlSeconds)
    if (error || !data?.signedUrl) return url // fall back to the original (still works while public)
    return data.signedUrl
  } catch {
    return url
  }
}
