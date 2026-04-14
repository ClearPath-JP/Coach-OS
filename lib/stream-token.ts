import { createHmac, timingSafeEqual } from 'crypto'

const TTL_SECONDS_DEFAULT = 3600

function getSecret(): string | null {
  const s = process.env.VIDEO_STREAM_TOKEN_SECRET?.trim()
  if (s) return s
  return null
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function b64urlDecode(s: string): Buffer | null {
  try {
    return Buffer.from(s, 'base64url')
  } catch {
    return null
  }
}

export type StreamTokenPayload = {
  videoId: string
  userId: string
  exp: number
  email: string | null
}

function parsePayloadString(payload: string): StreamTokenPayload | null {
  const parts = payload.split(':')
  if (parts.length < 3) return null
  const videoId = parts[0] ?? ''
  const userId = parts[1] ?? ''
  const expStr = parts[2] ?? ''
  const emailParts = parts.slice(3)
  const exp = Number.parseInt(expStr, 10)
  if (!videoId || !userId || !Number.isFinite(exp)) return null
  const email =
    emailParts.length > 0 ? decodeURIComponent(emailParts.join(':')) : null
  return { videoId, userId, exp, email: email?.trim() ? email : null }
}

/**
 * Signed token for video stream URLs (Range requests skip session re-validation).
 * Optional `email` helps resolve portal clients when `profiles.email` is unset.
 */
export function signStreamToken(
  videoId: string,
  userId: string,
  ttlSeconds = TTL_SECONDS_DEFAULT,
  email: string | null = null
): {
  token: string
  expiresAt: number
} {
  const secret = getSecret()
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const emailEnc = email?.trim() ? encodeURIComponent(email.trim()) : ''
  const payload = emailEnc ? `${videoId}:${userId}:${exp}:${emailEnc}` : `${videoId}:${userId}:${exp}`
  if (!secret) {
    throw new Error(
      'VIDEO_STREAM_TOKEN_SECRET is not set — cannot sign stream tokens. Add it to your environment variables.'
    )
  }
  const sig = createHmac('sha256', secret).update(payload).digest()
  const token = `${b64url(Buffer.from(payload, 'utf8'))}.${b64url(sig)}`
  return { token, expiresAt: exp * 1000 }
}

export function verifyStreamToken(token: string): StreamTokenPayload | null {
  // Reject unsigned tokens — they are not trustworthy
  const rawCheck = b64urlDecode(token)
  if (rawCheck) {
    const s = rawCheck.toString('utf8')
    if (s.startsWith('unsigned:')) return null
  }

  const secret = getSecret()
  if (!secret) return null

  const dot = token.indexOf('.')
  if (dot < 1) return null
  const payloadPart = token.slice(0, dot)
  const sigPart = token.slice(dot + 1)
  const payloadBuf = b64urlDecode(payloadPart)
  const sigBuf = b64urlDecode(sigPart)
  if (!payloadBuf || !sigBuf) return null
  const payload = payloadBuf.toString('utf8')
  const parsed = parsePayloadString(payload)
  if (!parsed) return null
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null

  const expected = createHmac('sha256', secret).update(payload).digest()
  if (expected.length !== sigBuf.length || !timingSafeEqual(expected, sigBuf)) return null
  return parsed
}
