import {
  COACH_EMAIL,
  COACH_PASSWORD,
  fetchJson,
  loadPersistedTestContext,
  sessionCookiesFromPassword,
  testContext,
} from './setup'

describe('06 client UI flows', () => {
  beforeAll(() => {
    loadPersistedTestContext()
    if (
      !testContext.flowClientId ||
      !testContext.flowClientEmail ||
      !testContext.flowClientPassword ||
      !testContext.flowProgramId ||
      !testContext.flowExtraModuleId
    ) {
      throw new Error('Run 05-coach-ui-flows.test.ts first (missing flow test context)')
    }
  })

  beforeEach(async () => {
    testContext.clientCookie = await sessionCookiesFromPassword(
      testContext.flowClientEmail,
      testContext.flowClientPassword
    )
    testContext.coachCookie = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
  })

  it('FLOW 1a — client portal: programs + invoices', async () => {
    const programs = await fetchJson('/api/client/programs', {
      cookieJar: testContext.clientCookie,
    })
    expect(programs.res.status).toBe(200)
    const pdata = programs.json as { data?: unknown }
    expect(Array.isArray(pdata.data)).toBe(true)

    const invoices = await fetchJson('/api/client/invoices', {
      cookieJar: testContext.clientCookie,
    })
    expect(invoices.res.status).toBe(200)
    const idata = invoices.json as { data?: unknown[] }
    expect(Array.isArray(idata.data)).toBe(true)
  })

  it('FLOW 1b — pending invoice count + client sessions', async () => {
    const pending = await fetchJson('/api/client/invoices/pending-count', {
      cookieJar: testContext.clientCookie,
    })
    expect(pending.res.status).toBe(200)
    const n = (pending.json as { data?: { count?: number } }).data?.count
    expect(typeof n).toBe('number')

    const sessions = await fetchJson('/api/client/sessions', {
      cookieJar: testContext.clientCookie,
    })
    expect(sessions.res.status).toBe(200)
    const sdata = sessions.json as { data?: { upcoming?: unknown[] } }
    expect(Array.isArray(sdata.data?.upcoming)).toBe(true)
  })

  it('FLOW 2a — coach sends message; client reads thread', async () => {
    const clientId = testContext.flowClientId
    const send = await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        content: 'Coach to client test',
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = send.cookieJar
    expect(send.res.status).toBe(200)

    const thread = await fetchJson(`/api/messages?clientId=${encodeURIComponent(clientId)}`, {
      cookieJar: testContext.clientCookie,
    })
    testContext.clientCookie = thread.cookieJar
    expect(thread.res.status).toBe(200)
    const msgs = thread.json as { data?: { content?: string }[] }
    expect((msgs.data ?? []).some((m) => m.content === 'Coach to client test')).toBe(true)
  })

  it('FLOW 2b — client replies; coach sees both messages', async () => {
    const clientId = testContext.flowClientId
    const reply = await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        content: 'Client to coach reply',
      }),
      cookieJar: testContext.clientCookie,
    })
    testContext.clientCookie = reply.cookieJar
    expect(reply.res.status).toBe(200)

    const thread = await fetchJson(`/api/messages?clientId=${encodeURIComponent(clientId)}`, {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = thread.cookieJar
    expect(thread.res.status).toBe(200)
    const msgs = thread.json as { data?: { content?: string; sender_id?: string }[] }
    const list = msgs.data ?? []
    const coachMsg = list.find((m) => m.content === 'Coach to client test')
    const clientMsg = list.find((m) => m.content === 'Client to coach reply')
    expect(coachMsg && clientMsg).toBeTruthy()
    expect(coachMsg?.sender_id).toBeTruthy()
    expect(clientMsg?.sender_id).toBeTruthy()
    expect(coachMsg?.sender_id).not.toBe(clientMsg?.sender_id)
  })

  it('FLOW 3 — client program detail + complete extra module increases progress', async () => {
    const programId = testContext.flowProgramId
    const extraModuleId = testContext.flowExtraModuleId

    const list = await fetchJson('/api/client/programs', {
      cookieJar: testContext.clientCookie,
    })
    testContext.clientCookie = list.cookieJar
    expect(list.res.status).toBe(200)
    const programs = list.json as { data?: { programId?: string }[] }
    expect((programs.data ?? []).some((p) => p.programId === programId)).toBe(true)

    const detailBefore = await fetchJson(`/api/client/programs/${programId}`, {
      cookieJar: testContext.clientCookie,
    })
    testContext.clientCookie = detailBefore.cookieJar
    expect(detailBefore.res.status).toBe(200)
    const before = detailBefore.json as {
      data?: { modules?: unknown[]; progress?: { modulesCompleted?: number } }
    }
    expect((before.data?.modules ?? []).length).toBeGreaterThan(0)
    const n0 = before.data?.progress?.modulesCompleted ?? 0

    const done = await fetchJson(`/api/progress/${extraModuleId}/complete`, {
      method: 'POST',
      cookieJar: testContext.clientCookie,
    })
    testContext.clientCookie = done.cookieJar
    expect(done.res.status).toBe(200)

    const detailAfter = await fetchJson(`/api/client/programs/${programId}`, {
      cookieJar: testContext.clientCookie,
    })
    testContext.clientCookie = detailAfter.cookieJar
    expect(detailAfter.res.status).toBe(200)
    const n1 = (detailAfter.json as { data?: { progress?: { modulesCompleted?: number } } }).data
      ?.progress?.modulesCompleted
    expect(typeof n1).toBe('number')
    expect((n1 as number) > n0).toBe(true)
  })

  it('FLOW 4a — client cannot access clients or packages APIs', async () => {
    const jar = testContext.clientCookie
    for (const path of ['/api/clients', '/api/packages']) {
      const res = await fetchJson(path, { cookieJar: jar })
      expect([401, 403]).toContain(res.res.status)
    }
  })

  it('FLOW 4b — client cannot access payments or coach analytics', async () => {
    const jar = testContext.clientCookie
    for (const path of ['/api/payments', '/api/coach/analytics']) {
      const res = await fetchJson(path, { cookieJar: jar })
      expect([401, 403]).toContain(res.res.status)
    }
  })
})
