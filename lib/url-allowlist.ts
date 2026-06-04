/**
 * SSRF guard for server-side fetches of DB/user-supplied media URLs.
 * Deny-by-default: only https + an allowlisted host passes.
 * Blocks private/link-local/metadata SSRF targets.
 *
 * Allowlist derived from:
 *  - next.config.ts CSP (connect-src, media-src, frame-src, img-src, remotePatterns)
 *  - lib/bunny.ts CDN URL construction (BUNNY_STREAM_CDN_HOST → *.b-cdn.net)
 *  - stream/route.ts Google Drive proxy (googleapis.com)
 *  - google-drive integration routes (googleapis.com, oauth2.googleapis.com)
 */

const ALLOWED_MEDIA_HOST_SUFFIXES: string[] = [
  // Bunny Stream CDN — mp4, hls, thumbnails, captions, TUS endpoint
  '.b-cdn.net',
  'video.bunnycdn.com',
  // Bunny embedded player
  'iframe.mediadelivery.net',
  // Supabase Storage — playback_url for Supabase-stored videos + thumbnails
  '.supabase.co',
  // Google APIs — Drive file proxy, OAuth token exchange, userinfo
  '.googleapis.com',
  // Google user-content — Drive thumbnails (lh3.googleusercontent.com)
  '.googleusercontent.com',
  // Cloudinary — remotePatterns allows res.cloudinary.com for thumbnails
  'res.cloudinary.com',
]

/**
 * Returns true only when `raw` is an https URL whose hostname is on the
 * allowlist AND is not a private/loopback/link-local/metadata address.
 *
 * Use this before any server-side fetch() of a DB-sourced or user-supplied URL.
 */
export function isAllowedMediaUrl(raw: string | null | undefined): boolean {
  if (!raw) return false
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }

  // Only HTTPS — never http, ftp, file, etc.
  if (u.protocol !== 'https:') return false

  const host = u.hostname.toLowerCase()

  // Hard-block obvious SSRF targets even if somehow mis-added to the suffix list.
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain')
  ) {
    return false
  }
  // IPv4 private + loopback + link-local (169.254 = cloud metadata)
  if (/^(127\.|10\.|169\.254\.|192\.168\.|0\.0\.0\.0)/.test(host)) return false
  // RFC-1918 172.16.0.0/12
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
  // IPv6 loopback, ULA (fc00::/7), and link-local (fe80::/10)
  // Strip brackets that URL parsing retains for IPv6 literals, e.g. "[::1]" → "::1"
  const bare = host.replace(/^\[/, '').replace(/\]$/, '')
  if (bare === '::1') return false
  if (/^(fc|fd)[0-9a-f:]+$/i.test(bare)) return false   // ULA fc00::/7
  if (/^fe[89ab][0-9a-f:]*$/i.test(bare)) return false  // link-local fe80::/10

  // Allowlist check: exact host OR suffix match (e.g. "foo.b-cdn.net" ends with ".b-cdn.net")
  return ALLOWED_MEDIA_HOST_SUFFIXES.some(
    (s) => host === s.replace(/^\./, '') || host.endsWith(s)
  )
}
