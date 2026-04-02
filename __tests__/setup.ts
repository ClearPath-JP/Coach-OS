import fs from 'fs'
import path from 'path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(__dirname, '../.env.local') })

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

export const COACH_EMAIL = 'test-coach@clearpath.test'
export const COACH_PASSWORD = 'TestCoach123!'

export const CLIENT_EMAIL = 'test-client@clearpath.test'
export const CLIENT_PASSWORD = 'TestClient123!'

// Next dev can spend >20s compiling heavy routes on first hit; keep API tests from aborting early.
const FETCH_TIMEOUT_MS = 45_000
const FETCH_RETRIES = 3

export type TestContext = {
  coachCookie: string
  clientCookie: string
  clientId: string
  packageId: string
  invoiceId: string
  programId: string
  moduleId: string
  sessionId: string
  /** Populated by 05-coach-ui-flows for 06-client-ui-flows */
  flowClientId: string
  flowClientEmail: string
  flowClientPassword: string
  flowProgramId: string
  flowModuleId: string
  flowExtraModuleId: string
}

/** Shared across Jest test files (separate module instances otherwise duplicate this object). */
const g = globalThis as unknown as { __clearpathTestContext?: TestContext }
export const testContext: TestContext =
  g.__clearpathTestContext ??
  (g.__clearpathTestContext = {
    coachCookie: '',
    clientCookie: '',
    clientId: '',
    packageId: '',
    invoiceId: '',
    programId: '',
    moduleId: '',
    sessionId: '',
    flowClientId: '',
    flowClientEmail: '',
    flowClientPassword: '',
    flowProgramId: '',
    flowModuleId: '',
    flowExtraModuleId: '',
  })

const CONTEXT_FILE = path.join(__dirname, '.test-context.json')

export function persistTestContext(): void {
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(testContext, null, 2), 'utf8')
}

export function loadPersistedTestContext(): void {
  if (!fs.existsSync(CONTEXT_FILE)) return
  try {
    const raw = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8')) as Partial<TestContext>
    Object.assign(testContext, raw)
  } catch {
    /* ignore */
  }
}

export function clearPersistedTestContextFile(): void {
  try {
    if (fs.existsSync(CONTEXT_FILE)) fs.unlinkSync(CONTEXT_FILE)
  } catch {
    /* ignore */
  }
}

/** Clear IDs produced by 02-coach-flows so globalThis state from a prior Jest run cannot poison the next run. */
export function resetCoachApiFlowContext(): void {
  testContext.clientId = ''
  testContext.packageId = ''
  testContext.invoiceId = ''
  testContext.programId = ''
  testContext.moduleId = ''
  testContext.sessionId = ''
  testContext.clientCookie = ''
}

export function mergeCookieJar(jar: string, response: Response): string {
  const h = response.headers as unknown as { getSetCookie?: () => string[] }
  let lines: string[] = []
  if (typeof h.getSetCookie === 'function') {
    lines = h.getSetCookie() ?? []
  } else {
    const single = response.headers.get('set-cookie')
    if (single) lines = [single]
  }
  const map = new Map<string, string>()
  if (jar) {
    for (const part of jar.split(';')) {
      const p = part.trim()
      const eq = p.indexOf('=')
      if (eq > 0) map.set(p.slice(0, eq), p.slice(eq + 1))
    }
  }
  for (const line of lines) {
    const first = line.split(';')[0]?.trim()
    if (!first?.includes('=')) continue
    const eq = first.indexOf('=')
    map.set(first.slice(0, eq), first.slice(eq + 1))
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function isRetryableFetchError(err: unknown): boolean {
  const msg = toErrorMessage(err).toLowerCase()
  return (
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('und_err') ||
    msg.includes('network error') ||
    msg.includes('fetch failed')
  )
}

async function fetchWithTimeoutAndRetry(
  input: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    try {
      const headers = new Headers(init.headers as HeadersInit | undefined)
      headers.set('Connection', 'close')
      const res = await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      })
      return res
    } catch (err) {
      lastErr = err
      if (attempt >= FETCH_RETRIES || !isRetryableFetchError(err)) {
        throw err
      }
      await sleep(250 * (attempt + 1))
    } finally {
      clearTimeout(timeoutId)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Unknown fetch failure')
}

/**
 * Password grant at Supabase + POST /api/auth/session so Set-Cookie works in Node fetch tests.
 */
export async function sessionCookiesFromPassword(
  email: string,
  password: string
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for API tests'
    )
  }
  const tokenRes = await fetchWithTimeoutAndRetry(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  })
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    error_description?: string
    msg?: string
  }
  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
    throw new Error(
      tokenJson.error_description ??
        tokenJson.msg ??
        `Password grant failed (${tokenRes.status})`
    )
  }
  const sessionRes = await fetchWithTimeoutAndRetry(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
    }),
  })
  const jar = mergeCookieJar('', sessionRes)
  if (!sessionRes.ok) {
    const text = await sessionRes.text()
    throw new Error(`Session cookie exchange failed (${sessionRes.status}): ${text}`)
  }
  return jar
}

export async function fetchJson(
  path: string,
  init: RequestInit & { cookieJar?: string } = {}
): Promise<{ res: Response; json: unknown; cookieJar: string }> {
  const { cookieJar = '', ...rest } = init
  const headers = new Headers(rest.headers as HeadersInit | undefined)
  if (cookieJar) headers.set('Cookie', cookieJar)
  const res = await fetchWithTimeoutAndRetry(`${BASE_URL}${path}`, { ...rest, headers })
  const nextJar = mergeCookieJar(cookieJar, res)
  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { res, json, cookieJar: nextJar }
}
