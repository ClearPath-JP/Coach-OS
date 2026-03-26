import { createClient } from '@supabase/supabase-js'
import {
  BASE_URL,
  COACH_EMAIL,
  COACH_PASSWORD,
  fetchJson,
  persistTestContext,
  sessionCookiesFromPassword,
  testContext,
} from './setup'
import { deleteTestClientsByEmailPrefix, ensureCoachAuthAndWorkspace } from './lib/fixture'
import { format } from 'date-fns'

const FLOW_COACH_PASSWORD = 'FlowCoach123!'

function nextMondayYmd(): string {
  const d = new Date()
  const dow = d.getDay()
  const daysUntilMon = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow
  d.setDate(d.getDate() + daysUntilMon)
  return d.toISOString().slice(0, 10)
}

/** Avoid overlap with sessions auto-created by invoice mark-paid (same workspace). */
function sessionBookingDateYmd(): string {
  const base = new Date(nextMondayYmd() + 'T12:00:00Z')
  base.setUTCDate(base.getUTCDate() + 14)
  return base.toISOString().slice(0, 10)
}

async function createConfirmedCoachUser(email: string, password: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required')
  }
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const em = email.trim().toLowerCase()
  const { data: page } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = page?.users?.find((u) => u.email?.toLowerCase() === em)
  if (existing?.id) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Flow Onboarding Coach' },
    })
    return
  }
  const { error } = await admin.auth.admin.createUser({
    email: em,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Flow Onboarding Coach' },
  })
  if (error) throw new Error(error.message)
}

describe('05 coach UI flows', () => {
  beforeAll(async () => {
    const ping = await fetch(`${BASE_URL}/api/clients`)
    if (ping.status !== 401) {
      throw new Error(`Start dev server: pnpm dev (expected GET /api/clients → 401)`)
    }
    await ensureCoachAuthAndWorkspace()
    await deleteTestClientsByEmailPrefix('flow-client-')
  })

  beforeEach(async () => {
    testContext.coachCookie = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
  })

  afterAll(() => {
    persistTestContext()
  })

  it('FLOW 1 — complete coach onboarding (new user)', async () => {
    const email = `flow-onboard-${Date.now()}@clearpath.test`
    await createConfirmedCoachUser(email, FLOW_COACH_PASSWORD)
    let jar = await sessionCookiesFromPassword(email, FLOW_COACH_PASSWORD)

    const complete = await fetchJson('/api/auth/signup-complete', {
      method: 'POST',
      cookieJar: jar,
    })
    jar = complete.cookieJar
    expect(complete.res.status).toBe(200)

    const ws = await fetchJson('/api/onboarding/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Coaching',
        logo_url: null,
        avatar_url: null,
      }),
      cookieJar: jar,
    })
    jar = ws.cookieJar
    expect(ws.res.status).toBe(200)

    const coach = await fetchJson('/api/onboarding/coaching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coaching_types: ['Fitness'],
        current_client_count: 0,
      }),
      cookieJar: jar,
    })
    jar = coach.cookieJar
    expect(coach.res.status).toBe(200)

    const done = await fetchJson('/api/workspaces/complete-onboarding', {
      method: 'PATCH',
      cookieJar: jar,
    })
    jar = done.cookieJar
    expect(done.res.status).toBe(200)

    const settings = await fetchJson('/api/settings', { cookieJar: jar })
    expect(settings.res.status).toBe(200)
    const body = settings.json as {
      data?: { workspace?: { completedOnboarding?: boolean } }
    }
    expect(body.data?.workspace?.completedOnboarding).toBe(true)
  })

  it('FLOW 2 — full client lifecycle (create, list, pause, resume)', async () => {
    const email = `flow-client-${Date.now()}@clearpath.test`
    const create = await fetchJson('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Flow',
        lastName: 'TestClient',
        email,
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = create.cookieJar
    expect(create.res.status).toBe(200)
    const created = create.json as { data?: { client?: { id?: string }; tempPassword?: string } }
    expect(created.data?.tempPassword).toBeTruthy()
    const clientId = created.data?.client?.id
    expect(clientId).toBeTruthy()
    testContext.flowClientId = clientId!
    testContext.flowClientEmail = email.trim().toLowerCase()
    testContext.flowClientPassword = created.data!.tempPassword!

    const list = await fetchJson('/api/clients', { cookieJar: testContext.coachCookie })
    testContext.coachCookie = list.cookieJar
    expect(list.res.status).toBe(200)
    const clients = list.json as { data?: { email?: string }[] }
    expect((clients.data ?? []).some((c) => c.email === email.trim().toLowerCase())).toBe(true)

    const pause = await fetchJson(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = pause.cookieJar
    expect(pause.res.status).toBe(200)

    const getOne = await fetchJson(`/api/clients/${clientId}`, {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = getOne.cookieJar
    expect(getOne.res.status).toBe(200)
    expect((getOne.json as { data?: { status?: string } }).data?.status).toBe('paused')

    const resume = await fetchJson(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = resume.cookieJar
    expect(resume.res.status).toBe(200)
  })

  it('FLOW 3 — messaging thread, conversations, mark read, unread count', async () => {
    const clientId = testContext.flowClientId
    const clientJar = await sessionCookiesFromPassword(
      testContext.flowClientEmail,
      testContext.flowClientPassword
    )
    await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, content: 'Unread seed for coach' }),
      cookieJar: clientJar,
    })

    const send = await fetchJson('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, content: 'Hello flow test' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = send.cookieJar
    expect(send.res.status).toBe(200)

    const thread = await fetchJson(`/api/messages?clientId=${encodeURIComponent(clientId)}`, {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = thread.cookieJar
    expect(thread.res.status).toBe(200)
    const msgs = thread.json as { data?: { content?: string }[] }
    expect((msgs.data ?? []).some((m) => m.content === 'Hello flow test')).toBe(true)

    const conv = await fetchJson('/api/messages/conversations', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = conv.cookieJar
    expect(conv.res.status).toBe(200)
    const convs = conv.json as {
      data?: { clientId?: string; lastMessagePreview?: string }[]
    }
    const row = (convs.data ?? []).find((c) => c.clientId === clientId)
    expect(row).toBeTruthy()
    expect((row?.lastMessagePreview ?? '').length).toBeGreaterThan(0)

    const beforeMark = (await fetchJson('/api/messages/unread-count', {
      cookieJar: testContext.coachCookie,
    })) as { res: Response; json: unknown; cookieJar: string }
    testContext.coachCookie = beforeMark.cookieJar
    const unreadBefore = (beforeMark.json as { data?: { count?: number } }).data?.count ?? 0
    expect(unreadBefore).toBeGreaterThanOrEqual(1)

    const read = await fetchJson('/api/messages/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = read.cookieJar
    expect(read.res.status).toBe(200)

    const unread = await fetchJson('/api/messages/unread-count', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = unread.cookieJar
    expect(unread.res.status).toBe(200)
    const unreadAfter = (unread.json as { data?: { count?: number } }).data?.count ?? 0
    expect(unreadAfter).toBeLessThan(unreadBefore)
  })

  it('FLOW 4a — package + invoice + pending list', async () => {
    const pkg = await fetchJson('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Flow Test Package',
        price_cents: 9900,
        duration_minutes: 60,
        session_type: 'video',
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = pkg.cookieJar
    expect(pkg.res.status).toBe(200)
    const packageId = (pkg.json as { data?: { id?: string } }).data?.id
    expect(packageId).toBeTruthy()

    const inv = await fetchJson('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId,
        clientId: testContext.flowClientId,
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = inv.cookieJar
    expect(inv.res.status).toBe(200)
    const invoiceId = (inv.json as { data?: { id?: string } }).data?.id
    expect(invoiceId).toBeTruthy()
    testContext.invoiceId = invoiceId!

    const pending = await fetchJson('/api/invoices?status=pending', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = pending.cookieJar
    expect(pending.res.status).toBe(200)
    const rows = pending.json as { data?: { id?: string }[] }
    expect((rows.data ?? []).some((r) => r.id === invoiceId)).toBe(true)
  })

  it('FLOW 4b — mark paid, paid list, auto payment row', async () => {
    const paid = await fetchJson(`/api/invoices/${testContext.invoiceId}/mark-paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'venmo',
        paymentReference: 'test-ref-456',
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = paid.cookieJar
    expect(paid.res.status).toBe(200)

    const listPaid = await fetchJson('/api/invoices?status=paid', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = listPaid.cookieJar
    expect(listPaid.res.status).toBe(200)
    const invs = listPaid.json as { data?: { id?: string; status?: string }[] }
    const row = (invs.data ?? []).find((r) => r.id === testContext.invoiceId)
    expect(row?.status).toBe('paid')

    const pays = await fetchJson('/api/payments', { cookieJar: testContext.coachCookie })
    testContext.coachCookie = pays.cookieJar
    expect(pays.res.status).toBe(200)
    const plist = pays.json as { data?: { invoice_id?: string; payment_method?: string }[] }
    const pay = (plist.data ?? []).find((p) => p.invoice_id === testContext.invoiceId)
    expect(pay?.payment_method).toBe('venmo')
  })

  it('FLOW 5a — availability + materialize + book session', async () => {
    const clientId = testContext.flowClientId
    const av = await fetchJson('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = av.cookieJar
    expect(av.res.status).toBe(200)

    const mat = await fetchJson('/api/availability/materialize', {
      method: 'POST',
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = mat.cookieJar
    expect(mat.res.status).toBe(200)

    const bookDate = sessionBookingDateYmd()
    const sess = await fetchJson('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        date: bookDate,
        startTime: '15:30',
        durationMinutes: 60,
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = sess.cookieJar
    expect(sess.res.status).toBe(200)
    const sessionId = (sess.json as { data?: { id?: string } }).data?.id
    expect(sessionId).toBeTruthy()
    testContext.sessionId = sessionId!
  })

  it('FLOW 5b — list session, mark completed, excluded from coach upcoming', async () => {
    const sessionId = testContext.sessionId
    const bookDate = sessionBookingDateYmd()
    const from = `${bookDate}T00:00:00.000Z`
    const to = `${bookDate}T23:59:59.999Z`
    const list = await fetchJson(
      `/api/coach/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { cookieJar: testContext.coachCookie }
    )
    testContext.coachCookie = list.cookieJar
    expect(list.res.status).toBe(200)
    const sessions = list.json as { data?: { id?: string }[] }
    expect((sessions.data ?? []).some((s) => s.id === sessionId)).toBe(true)

    const patch = await fetchJson(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = patch.cookieJar
    expect(patch.res.status).toBe(200)

    const upcoming = await fetchJson('/api/coach/sessions', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = upcoming.cookieJar
    expect(upcoming.res.status).toBe(200)
    const up = upcoming.json as { data?: { id?: string }[] }
    expect((up.data ?? []).some((s) => s.id === sessionId)).toBe(false)
  })

  it('FLOW 6a — program, module, content, publish, assign, progress baseline', async () => {
    const clientId = testContext.flowClientId
    const prog = await fetchJson('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Flow Test Program', description: 'Test' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = prog.cookieJar
    expect(prog.res.status).toBe(200)
    const programId = (prog.json as { data?: { id?: string } }).data?.id
    expect(programId).toBeTruthy()
    testContext.flowProgramId = programId!

    const mod = await fetchJson(`/api/programs/${programId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Module One', position: 0 }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = mod.cookieJar
    expect(mod.res.status).toBe(200)
    const moduleId = (mod.json as { data?: { id?: string } }).data?.id
    expect(moduleId).toBeTruthy()
    testContext.flowModuleId = moduleId!

    const content = await fetchJson(
      `/api/programs/${programId}/modules/${moduleId}/content`,
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
    testContext.coachCookie = content.cookieJar
    expect(content.res.status).toBe(200)

    const pub = await fetchJson(`/api/programs/${programId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = pub.cookieJar
    expect(pub.res.status).toBe(200)

    const asg = await fetchJson(`/api/programs/${programId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = asg.cookieJar
    expect(asg.res.status).toBe(200)

    const progress = await fetchJson(`/api/programs/${programId}/progress`, {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = progress.cookieJar
    expect(progress.res.status).toBe(200)
    const rows = progress.json as { data?: { clientId?: string; modulesCompleted?: number }[] }
    const pr = (rows.data ?? []).find((r) => r.clientId === clientId)
    expect(pr?.modulesCompleted).toBe(0)
  })

  it('FLOW 6b — client completes module; coach sees progress; extra module for client tests', async () => {
    const programId = testContext.flowProgramId
    const moduleId = testContext.flowModuleId
    const clientId = testContext.flowClientId
    const clientJar = await sessionCookiesFromPassword(
      testContext.flowClientEmail,
      testContext.flowClientPassword
    )

    const complete = await fetchJson(`/api/progress/${moduleId}/complete`, {
      method: 'POST',
      cookieJar: clientJar,
    })
    expect(complete.res.status).toBe(200)

    const progress = await fetchJson(`/api/programs/${programId}/progress`, {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = progress.cookieJar
    expect(progress.res.status).toBe(200)
    const rows = progress.json as { data?: { clientId?: string; modulesCompleted?: number }[] }
    const pr = (rows.data ?? []).find((r) => r.clientId === clientId)
    expect(pr?.modulesCompleted).toBe(1)

    const mod2 = await fetchJson(`/api/programs/${programId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Module Two', position: 1 }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = mod2.cookieJar
    expect(mod2.res.status).toBe(200)
    const mid2 = (mod2.json as { data?: { id?: string } }).data?.id
    expect(mid2).toBeTruthy()
    testContext.flowExtraModuleId = mid2!
  })

  it('FLOW 7a — manual payment + list + monthly summary', async () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const post = await fetchJson('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: testContext.flowClientId,
        amountCents: 14900,
        paymentMethod: 'cashapp',
        paymentDate: today,
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = post.cookieJar
    expect(post.res.status).toBe(200)
    const paymentId = (post.json as { data?: { id?: string } }).data?.id
    expect(paymentId).toBeTruthy()

    const list = await fetchJson('/api/payments', { cookieJar: testContext.coachCookie })
    testContext.coachCookie = list.cookieJar
    expect(list.res.status).toBe(200)
    const rows = list.json as { data?: { id?: string }[] }
    expect((rows.data ?? []).some((p) => p.id === paymentId)).toBe(true)

    const sum = await fetchJson('/api/payments/summary?period=month', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = sum.cookieJar
    expect(sum.res.status).toBe(200)
    const total = (sum.json as { data?: { totalRevenue?: number } }).data?.totalRevenue ?? 0
    expect(total).toBeGreaterThanOrEqual(14900)
  })

  it('FLOW 7b — coach analytics revenue + recent activity', async () => {
    const an = await fetchJson('/api/coach/analytics?period=month', {
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = an.cookieJar
    expect(an.res.status).toBe(200)
    const body = an.json as {
      data?: { paymentSummary?: { totalRevenue?: number }; recentActivity?: unknown[] }
    }
    expect(typeof body.data?.paymentSummary?.totalRevenue).toBe('number')
    expect(Array.isArray(body.data?.recentActivity)).toBe(true)
  })

  it('FLOW 8 — workspace branding + client branding + restore accent', async () => {
    const patch = await fetchJson('/api/settings/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: 'Elite Flow Coaching',
        accentColor: '#534AB7',
      }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = patch.cookieJar
    expect(patch.res.status).toBe(200)

    const settings = await fetchJson('/api/settings', { cookieJar: testContext.coachCookie })
    testContext.coachCookie = settings.cookieJar
    expect(settings.res.status).toBe(200)
    const ws = (settings.json as { data?: { workspace?: { brandName?: string; accentColor?: string } } })
      .data?.workspace
    expect(ws?.brandName).toBe('Elite Flow Coaching')
    expect(ws?.accentColor?.toLowerCase()).toBe('#534ab7')

    const clientJar = await sessionCookiesFromPassword(
      testContext.flowClientEmail,
      testContext.flowClientPassword
    )
    const brand = await fetchJson('/api/client/workspace-branding', { cookieJar: clientJar })
    expect(brand.res.status).toBe(200)
    const b = (brand.json as { data?: { brandName?: string } }).data
    expect(b?.brandName).toBe('Elite Flow Coaching')

    const restore = await fetchJson('/api/settings/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accentColor: '#2D7A6F' }),
      cookieJar: testContext.coachCookie,
    })
    testContext.coachCookie = restore.cookieJar
    expect(restore.res.status).toBe(200)
  })
})
