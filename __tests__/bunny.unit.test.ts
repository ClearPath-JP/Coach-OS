import { bunnyEmbedUrl, signBunnyUrl } from '@/lib/bunny'

// Pure-function unit tests for the Bunny playback helpers added with the
// gray-video fix. No network/DB — safe to run anytime (npm run test:unit).

describe('bunnyEmbedUrl', () => {
  const ORIGINAL = process.env.BUNNY_STREAM_LIBRARY_ID

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.BUNNY_STREAM_LIBRARY_ID
    else process.env.BUNNY_STREAM_LIBRARY_ID = ORIGINAL
  })

  it('builds the hosted player URL from an explicit library id', () => {
    expect(bunnyEmbedUrl('abc-123', '4567')).toBe(
      'https://iframe.mediadelivery.net/embed/4567/abc-123'
    )
  })

  it('falls back to the env library id when none is passed', () => {
    process.env.BUNNY_STREAM_LIBRARY_ID = '9999'
    expect(bunnyEmbedUrl('guid')).toBe('https://iframe.mediadelivery.net/embed/9999/guid')
  })

  it('returns null when there is no library id anywhere', () => {
    delete process.env.BUNNY_STREAM_LIBRARY_ID
    expect(bunnyEmbedUrl('guid')).toBeNull()
  })

  it('returns null for a blank guid', () => {
    expect(bunnyEmbedUrl('   ', '4567')).toBeNull()
  })

  it('url-encodes path segments to prevent traversal/injection', () => {
    expect(bunnyEmbedUrl('../evil', '4567')).toBe(
      'https://iframe.mediadelivery.net/embed/4567/..%2Fevil'
    )
  })
})

describe('signBunnyUrl', () => {
  const ORIGINAL = process.env.BUNNY_STREAM_TOKEN_KEY

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.BUNNY_STREAM_TOKEN_KEY
    else process.env.BUNNY_STREAM_TOKEN_KEY = ORIGINAL
  })

  it('is a no-op when token auth is disabled (no token key)', () => {
    delete process.env.BUNNY_STREAM_TOKEN_KEY
    const url = 'https://cdn.example.com/guid/play_720p.mp4'
    expect(signBunnyUrl(url)).toBe(url)
  })

  it('appends token + expires and preserves the path when a token key is set', () => {
    process.env.BUNNY_STREAM_TOKEN_KEY = 'test-key'
    const signed = signBunnyUrl('https://cdn.example.com/guid/thumbnail.jpg', 60)
    const u = new URL(signed)
    expect(u.searchParams.get('token')).toBeTruthy()
    expect(Number(u.searchParams.get('expires'))).toBeGreaterThan(0)
    expect(u.pathname).toBe('/guid/thumbnail.jpg')
  })
})
