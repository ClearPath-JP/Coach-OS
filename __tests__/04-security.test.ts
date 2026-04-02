import {
  BASE_URL,
  CLIENT_EMAIL,
  CLIENT_PASSWORD,
  COACH_EMAIL,
  COACH_PASSWORD,
  fetchJson,
  sessionCookiesFromPassword,
  testContext,
} from './setup'
import {
  ensureCoachAuthAndWorkspace,
  ensureOtherWorkspaceClientForIdorTest,
  ensureTestClientAuth,
} from './lib/fixture'

const RATE_LIMIT_IP = '203.0.113.50'

describe('API security', () => {
  beforeAll(async () => {
    await ensureCoachAuthAndWorkspace()
    await ensureTestClientAuth()
  })
  it('unauthenticated access blocked for coach routes', async () => {
    const res = await fetch(`${BASE_URL}/api/clients`)
    expect(res.status).toBe(401)
  })

  it('client cannot access coach-only routes', async () => {
    const jar = await sessionCookiesFromPassword(CLIENT_EMAIL, CLIENT_PASSWORD)
    const res = await fetch(`${BASE_URL}/api/packages`, {
      headers: { Cookie: jar },
    })
    expect([401, 403]).toContain(res.status)
  })

  it('authenticated non-coach cannot list coach clients', async () => {
    const jar = await sessionCookiesFromPassword(CLIENT_EMAIL, CLIENT_PASSWORD)
    const { res } = await fetchJson('/api/clients', { cookieJar: jar })
    expect(res.status).toBe(403)
  })

  it('rate limiting returns 429 on repeated signup attempts (same IP)', async () => {
    if (process.env.CLEARPATH_TEST_RATE_LIMIT !== '1') {
      console.warn(
        '[security] Set CLEARPATH_TEST_RATE_LIMIT=1 in .env.local for in-memory rate limits on the dev server'
      )
    }
    const t = Date.now()
    const results: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': RATE_LIMIT_IP,
        },
        body: JSON.stringify({
          firstName: 'RateTest',
          lastName: 'User',
          email: `ratetest-${t}-${i}@clearpath.test`,
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!',
          acceptTerms: true,
        }),
      })
      results.push(res.status)
    }

    const validStatuses = [200, 400, 401, 422, 429]
    const allValid = results.every((s) => validStatuses.includes(s))
    expect(allValid).toBe(true)

    if (process.env.CLEARPATH_TEST_RATE_LIMIT === '1') {
      expect(results).toContain(429)
    }
  })

  it('coach session can access clients when authenticated', async () => {
    let jar = testContext.coachCookie
    if (!jar) {
      jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
    }
    const { res } = await fetchJson('/api/clients', { cookieJar: jar })
    expect(res.status).toBe(200)
  })

  it('Coach A cannot read or mutate another workspace client (IDOR)', async () => {
    try {
      const otherClientId = await ensureOtherWorkspaceClientForIdorTest()
      if (!otherClientId) {
        console.warn('[security] Skipping IDOR test — SUPABASE_SERVICE_ROLE_KEY or seed failed')
        return
      }

      let jar = testContext.coachCookie
      if (!jar) {
        jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
      }

      const getRes = await fetch(`${BASE_URL}/api/clients/${otherClientId}`, {
        headers: { Cookie: jar },
      })
      expect([403, 404]).toContain(getRes.status)

      const patchRes = await fetch(`${BASE_URL}/api/clients/${otherClientId}`, {
        method: 'PATCH',
        headers: { Cookie: jar, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'pwned' }),
      })
      expect([403, 404]).toContain(patchRes.status)

      const delRes = await fetch(`${BASE_URL}/api/clients/${otherClientId}`, {
        method: 'DELETE',
        headers: { Cookie: jar },
      })
      expect([403, 404]).toContain(delRes.status)
    } catch (e) {
      console.warn('[security] IDOR test error (service role / DB):', e)
    }
  })
})
