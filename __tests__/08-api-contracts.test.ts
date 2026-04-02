import {
  BASE_URL,
  COACH_EMAIL,
  COACH_PASSWORD,
  fetchJson,
  sessionCookiesFromPassword,
} from './setup'
import { ensureCoachAuthAndWorkspace } from './lib/fixture'

describe('API contracts — validation and response shape', () => {
  beforeAll(async () => {
    const ping = await fetch(`${BASE_URL}/api/clients`)
    if (ping.status !== 401) {
      throw new Error(
        `Expected dev server at ${BASE_URL} (GET /api/clients → 401). Start: pnpm dev`
      )
    }
    await ensureCoachAuthAndWorkspace()
  })

  it('GET /api/messages without clientId returns 400', async () => {
    const jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
    const { res, json } = await fetchJson('/api/messages', { cookieJar: jar })
    expect(res.status).toBe(400)
    const body = json as { error?: string }
    expect(typeof body.error).toBe('string')
  })

  it('GET /api/programs without session returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/programs`)
    expect(res.status).toBe(401)
    const json = (await res.json()) as { error?: string }
    expect(typeof json.error).toBe('string')
  })

  it('POST /api/messages with invalid body returns 400 (Zod)', async () => {
    const jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
    const { res, json } = await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cookieJar: jar,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = json as { error?: string }
    expect(typeof body.error).toBe('string')
  })

  it('GET /api/messages with unknown clientId returns 404', async () => {
    const jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
    const fakeId = '00000000-0000-4000-8000-000000000000'
    const { res, json } = await fetchJson(`/api/messages?clientId=${fakeId}`, { cookieJar: jar })
    expect(res.status).toBe(404)
    const body = json as { error?: string }
    expect(typeof body.error).toBe('string')
  })

  it('GET /api/clients with coach session returns { data: array }', async () => {
    const jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
    const { res, json } = await fetchJson('/api/clients', { cookieJar: jar })
    expect(res.status).toBe(200)
    const body = json as { data?: unknown; error?: string }
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.error).toBeUndefined()
  })

  it('GET /api/goals without session returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/goals?clientId=00000000-0000-4000-8000-000000000000`)
    expect(res.status).toBe(401)
    const json = (await res.json()) as { error?: string }
    expect(typeof json.error).toBe('string')
  })

  it('GET /api/client/goals without session returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/client/goals`)
    expect(res.status).toBe(401)
  })

  it('POST /api/goals without session returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: '00000000-0000-4000-8000-000000000000', title: 'x' }),
    })
    expect(res.status).toBe(401)
  })
})
