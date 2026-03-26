import {
  BASE_URL,
  COACH_EMAIL,
  COACH_PASSWORD,
  fetchJson,
  sessionCookiesFromPassword,
  testContext,
} from './setup'
import { ensureCoachAuthAndWorkspace } from './lib/fixture'

describe('auth flows', () => {
  beforeAll(async () => {
    const ping = await fetch(`${BASE_URL}/api/clients`)
    if (ping.status !== 401) {
      throw new Error(
        `Expected dev server at ${BASE_URL} (GET /api/clients → 401). Start: pnpm dev`
      )
    }
    await ensureCoachAuthAndWorkspace()
  })

  it('coach signup — workspace + redirect', async () => {
    const { res, json } = await fetchJson('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Coach',
        email: COACH_EMAIL,
        password: COACH_PASSWORD,
        confirmPassword: COACH_PASSWORD,
        acceptTerms: true,
      }),
    })

    if (res.status === 400) {
      const err = json as { error?: string }
      expect(typeof err.error === 'string' && err.error.length > 0).toBe(true)
      return
    }

    if (res.status === 401) {
      return
    }
    expect(res.status).toBe(200)
    const body = json as {
      data?: { redirect?: string; workspaceId?: string; workspaceCreated?: boolean }
    }
    expect(body.data?.redirect).toBe('/onboarding')
    expect(body.data?.workspaceId).toBeTruthy()
  })

  it('coach login — session cookie', async () => {
    const jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
    expect(jar.length).toBeGreaterThan(0)
    testContext.coachCookie = jar
  })
})
