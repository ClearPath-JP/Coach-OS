import {
  CLIENT_EMAIL,
  CLIENT_PASSWORD,
  fetchJson,
  loadPersistedTestContext,
  mergeCookieJar,
  sessionCookiesFromPassword,
  testContext,
} from './setup'
import { setAuthUserPasswordByEmail } from './lib/admin-helpers'
import { ensureTestClientAuth } from './lib/fixture'

describe('client flows', () => {
  beforeAll(async () => {
    loadPersistedTestContext()
    await ensureTestClientAuth()
    if (!testContext.moduleId || !testContext.clientId) {
      throw new Error('Missing testContext — run 02-coach-flows.test.ts first')
    }
  })

  beforeEach(async () => {
    testContext.clientCookie = await sessionCookiesFromPassword(
      CLIENT_EMAIL,
      CLIENT_PASSWORD
    )
  })

  it('client set password (API success; portal is next step in app)', async () => {
    const ok = await setAuthUserPasswordByEmail(CLIENT_EMAIL, CLIENT_PASSWORD)
    if (!ok) {
      throw new Error(
        'Could not set client password (SUPABASE_SERVICE_ROLE_KEY or user missing)'
      )
    }
    let jar = await sessionCookiesFromPassword(CLIENT_EMAIL, CLIENT_PASSWORD)

    const tempPassword = `${CLIENT_PASSWORD}Chg`
    const setPw = await fetchJson('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: tempPassword }),
      cookieJar: jar,
    })
    jar = mergeCookieJar(jar, setPw.res)
    expect(setPw.res.status).toBe(200)
    await setAuthUserPasswordByEmail(CLIENT_EMAIL, CLIENT_PASSWORD)
    testContext.clientCookie = await sessionCookiesFromPassword(
      CLIENT_EMAIL,
      CLIENT_PASSWORD
    )
  })

  it('client login — session', async () => {
    const jar = await sessionCookiesFromPassword(CLIENT_EMAIL, CLIENT_PASSWORD)
    expect(jar.length).toBeGreaterThan(0)
    testContext.clientCookie = jar
  })

  it('get client portal programs', async () => {
    const { res, json } = await fetchJson('/api/client/programs', {
      cookieJar: testContext.clientCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: unknown }
    expect(body.data).toBeDefined()
  })

  it('get client sessions', async () => {
    const { res, json } = await fetchJson('/api/client/sessions', {
      cookieJar: testContext.clientCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { upcoming?: unknown[] } }
    expect(Array.isArray(body.data?.upcoming)).toBe(true)
  })

  it('get client invoices', async () => {
    const { res, json } = await fetchJson('/api/client/invoices', {
      cookieJar: testContext.clientCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('mark module complete', async () => {
    const { res } = await fetchJson(`/api/progress/${testContext.moduleId}/complete`, {
      method: 'POST',
      cookieJar: testContext.clientCookie,
    })
    expect(res.status).toBe(200)
  })

  it('send message as client', async () => {
    const { res, json } = await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: testContext.clientId,
        content: 'Reply from client',
      }),
      cookieJar: testContext.clientCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
  })
})
