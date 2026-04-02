import {
  clearPersistedTestContextFile,
  COACH_EMAIL,
  COACH_PASSWORD,
  CLIENT_EMAIL,
  fetchJson,
  persistTestContext,
  resetCoachApiFlowContext,
  sessionCookiesFromPassword,
  testContext,
} from './setup'
import { deleteTestClientRowForEmail } from './lib/fixture'
import { setAuthUserPasswordByEmail } from './lib/admin-helpers'
import { ensureCoachAuthAndWorkspace, ensureTestClientAuth } from './lib/fixture'

function uniqueSessionDateTime(): { date: string; startTime: string } {
  const d = new Date()
  d.setDate(d.getDate() + 1 + (Math.floor(Math.random() * 14) % 7))
  const mins = Math.floor(Math.random() * 59)
  const hour = 9 + (Math.floor(Math.random() * 8) % 6)
  return {
    date: d.toISOString().slice(0, 10),
    startTime: `${hour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
  }
}

describe('coach flows', () => {
  beforeAll(async () => {
    clearPersistedTestContextFile()
    resetCoachApiFlowContext()
    await ensureCoachAuthAndWorkspace()
    await deleteTestClientRowForEmail()
  })

  beforeEach(async () => {
    testContext.coachCookie = await sessionCookiesFromPassword(
      COACH_EMAIL,
      COACH_PASSWORD
    )
  })

  it('create client', async () => {
    const { res, json, cookieJar } = await fetchJson('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'Client',
        email: CLIENT_EMAIL,
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = cookieJar

    expect(res.status).toBe(200)
    const body = json as { data?: { client?: { id?: string }; tempPassword?: string } }
    expect(body.data?.client?.id).toBeTruthy()
    expect(body.data?.tempPassword).toBeTruthy()
    testContext.clientId = body.data!.client!.id!
  })

  it('send client invite', async () => {
    const { res, json } = await fetchJson('/api/invite-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CLIENT_EMAIL }),
      cookieJar: testContext.coachCookie,
    })
    if ([200, 400, 409].includes(res.status)) return
    console.warn('[coach-flows] invite-client:', res.status, json)
  })

  it('ensure client auth user + profile for messaging', async () => {
    await ensureTestClientAuth()
    await setAuthUserPasswordByEmail(CLIENT_EMAIL, 'TestClient123!')
  })

  it('create package', async () => {
    const { res, json } = await fetchJson('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Package',
        price_cents: 9900,
        duration_minutes: 60,
        session_type: 'video',
      }),
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
    testContext.packageId = body.data!.id!
  })

  it('send invoice via messages', async () => {
    const { res, json } = await fetchJson('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: testContext.packageId,
        clientId: testContext.clientId,
      }),
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string; message_id?: string } }
    expect(body.data?.id).toBeTruthy()
    testContext.invoiceId = body.data!.id!

    const thread = await fetchJson(
      `/api/messages?clientId=${encodeURIComponent(testContext.clientId)}`,
      { cookieJar: testContext.coachCookie }
    )
    expect(thread.res.status).toBe(200)
    const msgs = thread.json as { data?: { message_type?: string }[] }
    const invoiceMsg = (msgs.data ?? []).some((m) => m.message_type === 'invoice')
    expect(invoiceMsg).toBe(true)
  })

  it('mark invoice paid', async () => {
    const { res, json } = await fetchJson(
      `/api/invoices/${testContext.invoiceId}/mark-paid`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'venmo',
          paymentReference: 'test-ref-123',
        }),
        cookieJar: testContext.coachCookie,
      }
    )
    expect(res.status).toBe(200)
    const body = json as { data?: { status?: string } }
    expect(body.data?.status).toBe('paid')
  })

  it('create program', async () => {
    const { res, json } = await fetchJson('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Program',
        description: 'Test description',
      }),
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
    testContext.programId = body.data!.id!
  })

  it('add module to program', async () => {
    const { res, json } = await fetchJson(
      `/api/programs/${testContext.programId}/modules`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Module 1', position: 0 }),
        cookieJar: testContext.coachCookie,
      }
    )
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
    testContext.moduleId = body.data!.id!
  })

  it('add content to module', async () => {
    const { res, json } = await fetchJson(
      `/api/programs/${testContext.programId}/modules/${testContext.moduleId}/content`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'text',
          title: 'Welcome',
          body: 'This is test content',
        }),
        cookieJar: testContext.coachCookie,
      }
    )
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
  })

  it('assign program to client', async () => {
    const { res } = await fetchJson(`/api/programs/${testContext.programId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: testContext.clientId }),
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
  })

  it('book session', async () => {
    const slot = uniqueSessionDateTime()
    const { res, json } = await fetchJson('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: testContext.clientId,
        date: slot.date,
        startTime: slot.startTime,
        durationMinutes: 60,
        type: 'video',
      }),
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
    testContext.sessionId = body.data!.id!
  })

  it('send message', async () => {
    await ensureTestClientAuth()
    const { res, json } = await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: testContext.clientId,
        content: 'Hello test client',
      }),
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: { id?: string } }
    expect(body.data?.id).toBeTruthy()
  })

  it('get conversations', async () => {
    const { res, json } = await fetchJson('/api/messages/conversations', {
      cookieJar: testContext.coachCookie,
    })
    expect(res.status).toBe(200)
    const body = json as { data?: unknown[] }
    expect(Array.isArray(body.data)).toBe(true)
    expect((body.data ?? []).length).toBeGreaterThanOrEqual(1)
  })

  afterAll(() => {
    persistTestContext()
  })
})
