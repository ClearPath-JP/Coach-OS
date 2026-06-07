import 'server-only'
import crypto from 'crypto'
import { pickBestMp4Resolution } from './bunny-resolution'

/**
 * Bunny Stream helpers (server-only — uses the secret Stream API key).
 * Flow: createBunnyVideo() makes a video object + returns TUS upload credentials
 * for a direct browser→Bunny upload (key never reaches the client). getBunnyVideo()
 * polls encoding status + builds the CDN URLs. Bunny auto-transcribes (Whisper).
 * Docs: https://docs.bunny.net/stream/tus-resumable-uploads
 */

const VIDEO_API = 'https://video.bunnycdn.com'

function cfg() {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID
  const apiKey = process.env.BUNNY_STREAM_API_KEY
  const cdnHost = process.env.BUNNY_STREAM_CDN_HOST
  if (!libraryId || !apiKey || !cdnHost) {
    throw new Error('Bunny Stream not configured (BUNNY_STREAM_LIBRARY_ID / BUNNY_STREAM_API_KEY / BUNNY_STREAM_CDN_HOST)')
  }
  return { libraryId, apiKey, cdnHost }
}

export function bunnyConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY && process.env.BUNNY_STREAM_CDN_HOST
  )
}

/**
 * Sign a Bunny CDN file URL for Token Authentication (Basic scheme).
 * When the Stream library has Token Authentication on, direct file access
 * (mp4 / hls / thumbnail) 403s — a render pipeline (Remotion) needs a signed URL.
 * token = base64url(MD5(tokenKey + path + expires)); appended as ?token=&expires=.
 * The token key is the library's "URL Token Authentication Key" (≠ the Stream API key).
 * If BUNNY_STREAM_TOKEN_KEY is unset (token auth disabled), returns the URL unchanged.
 * Docs: https://docs.bunny.net/docs/cdn-token-authentication-basic
 */
export function signBunnyUrl(fileUrl: string, expiresInSec = 3 * 60 * 60): string {
  const tokenKey = process.env.BUNNY_STREAM_TOKEN_KEY
  if (!tokenKey) return fileUrl
  const u = new URL(fileUrl)
  const expires = Math.floor(Date.now() / 1000) + expiresInSec
  const token = crypto
    .createHash('md5')
    .update(tokenKey + u.pathname + expires)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  u.searchParams.set('token', token)
  u.searchParams.set('expires', String(expires))
  return u.toString()
}

/**
 * Bunny's hosted iframe player URL for a video. Plays HLS cross-browser (the
 * native <video> element can't), so this is what the UI embeds for playback.
 * Prefer the per-row library id; fall back to the env library id.
 * Returns null when no library id is available.
 */
export function bunnyEmbedUrl(guid: string, libraryId?: string | null): string | null {
  const lib = (libraryId ?? process.env.BUNNY_STREAM_LIBRARY_ID ?? '').toString().trim()
  if (!lib || !guid?.trim()) return null
  return `https://iframe.mediadelivery.net/embed/${encodeURIComponent(lib)}/${encodeURIComponent(guid.trim())}`
}

export type BunnyCreateResult = {
  videoId: string
  libraryId: string
  tusEndpoint: string
  authorizationSignature: string
  authorizationExpire: number
}

/** Create a video object and return TUS credentials for a direct browser upload. */
export async function createBunnyVideo(title: string): Promise<BunnyCreateResult> {
  const { libraryId, apiKey } = cfg()
  const res = await fetch(`${VIDEO_API}/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title: title.slice(0, 200) || 'Untitled clip' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Bunny create video failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { guid?: string }
  const videoId = data.guid
  if (!videoId) throw new Error('Bunny create video returned no guid')

  // TUS signature: SHA256(libraryId + apiKey + expire + videoId), expire = unix seconds.
  const authorizationExpire = Math.floor(Date.now() / 1000) + 3 * 60 * 60 // 3h headroom
  const authorizationSignature = crypto
    .createHash('sha256')
    .update(`${libraryId}${apiKey}${authorizationExpire}${videoId}`)
    .digest('hex')

  return { videoId, libraryId, tusEndpoint: `${VIDEO_API}/tusupload`, authorizationSignature, authorizationExpire }
}

/**
 * Creates a Bunny video object then triggers Bunny's server-side "fetch from URL"
 * so Bunny pulls and transcodes an existing MP4 (e.g. a rendered reel at output_url).
 * Bunny transcodes asynchronously — poll getBunnyVideo() to check readiness.
 * Returns the new Bunny guid and library id.
 */
export async function fetchBunnyVideoFromUrl(
  title: string,
  sourceUrl: string,
): Promise<{ guid: string; libraryId: string }> {
  const created = await createBunnyVideo(title)
  const { apiKey } = cfg()
  const res = await fetch(
    `${VIDEO_API}/library/${created.libraryId}/videos/${created.videoId}/fetch`,
    {
      method: 'POST',
      headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Bunny fetch-from-url failed (${res.status}): ${body.slice(0, 200)}`)
  }
  return { guid: created.videoId, libraryId: created.libraryId }
}

export type BunnyVideoStatus = {
  status: number
  ready: boolean
  failed: boolean
  hlsUrl: string
  mp4Url: string
  thumbnailUrl: string
  captionsVttUrl: string | null
  durationSeconds: number | null
}

// Bunny status: 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished, 5 Error, 6 UploadFailed
const FINISHED = 4
const FAILED = new Set([5, 6])

export async function getBunnyVideo(videoId: string): Promise<BunnyVideoStatus> {
  const { libraryId, apiKey, cdnHost } = cfg()
  const res = await fetch(`${VIDEO_API}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Bunny get video failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const v = (await res.json()) as {
    status?: number
    length?: number
    captions?: { srclang?: string; label?: string }[]
    availableResolutions?: string | null
  }
  const status = typeof v.status === 'number' ? v.status : 0
  const base = `https://${cdnHost}/${videoId}`

  const caps = (v.captions ?? [])
    .map((c) => (c?.srclang ?? '').trim())
    .filter(Boolean)
  const cap = caps.find((s) => s.toLowerCase().startsWith('en')) ?? caps[0] ?? null

  const resolutions = (v.availableResolutions ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const mp4Res = pickBestMp4Resolution(resolutions)

  return {
    status,
    ready: status === FINISHED,
    failed: FAILED.has(status),
    hlsUrl: `${base}/playlist.m3u8`,
    mp4Url: `${base}/play_${mp4Res}.mp4`,
    thumbnailUrl: `${base}/thumbnail.jpg`,
    captionsVttUrl: cap ? `${base}/captions/${cap}.vtt` : null,
    durationSeconds: typeof v.length === 'number' && v.length > 0 ? v.length : null,
  }
}

export type Caption = { startMs: number; endMs: number; text: string }

function tsToMs(ts: string): number {
  const m = ts.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/)
  if (!m) return 0
  const h = m[1] ? parseInt(m[1], 10) : 0
  const min = parseInt(m[2] ?? '0', 10)
  const sec = parseInt(m[3] ?? '0', 10)
  const ms = parseInt((m[4] ?? '0').padEnd(3, '0'), 10)
  return ((h * 60 + min) * 60 + sec) * 1000 + ms
}

/** Parse a WEBVTT string into caption cues. */
export function parseVtt(vtt: string): Caption[] {
  const cues: Caption[] = []
  for (const block of vtt.replace(/\r/g, '').split('\n\n')) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    const arrow = lines.findIndex((l) => l.includes('-->'))
    if (arrow === -1) continue
    const parts = (lines[arrow] ?? '').split('-->')
    const text = lines
      .slice(arrow + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!text) continue
    cues.push({ startMs: tsToMs(parts[0] ?? ''), endMs: tsToMs(parts[1] ?? ''), text })
  }
  return cues
}

/** Fetch + parse the auto-generated captions (public CDN VTT). */
export async function fetchBunnyCaptions(vttUrl: string): Promise<{ text: string; cues: Caption[] }> {
  try {
    const res = await fetch(vttUrl, { cache: 'no-store' })
    if (!res.ok) return { text: '', cues: [] }
    const cues = parseVtt(await res.text())
    return { text: cues.map((c) => c.text).join(' '), cues }
  } catch {
    return { text: '', cues: [] }
  }
}
