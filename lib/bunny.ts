import 'server-only'
import crypto from 'crypto'

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
  const mp4Res = resolutions.includes('720p') ? '720p' : (resolutions[resolutions.length - 1] ?? '720p')

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
