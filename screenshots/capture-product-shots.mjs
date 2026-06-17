// Capture real product screenshots from the seeded demo accounts for the landing showcase.
// Coach = desktop frame; Student = mobile frame. Saves crisp 2x PNGs to public/shots/.
// Creds via env (demo defaults match the repo's other verify scripts).
//   node screenshots/capture-product-shots.mjs
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'https://korvacoach.com'
const COACH_EMAIL = process.env.SMOKE_EMAIL ?? 'coach@example.com'
const COACH_PW = process.env.SMOKE_PW ?? 'Demo123!'
const CLIENT_EMAIL = process.env.CLIENT_EMAIL ?? 'client@example.com'
const CLIENT_PW = process.env.CLIENT_PASSWORD ?? 'ClientDemo123!'
const NO_ANIM = `*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;transition-delay:0s !important;}`

mkdirSync('public/shots', { recursive: true })
const browser = await chromium.launch()

async function shoot(page, path, name, waitMs = 3200) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.locator('.katana-overlay').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(waitMs)
    await page.addStyleTag({ content: NO_ANIM }).catch(() => {})
    await page.waitForTimeout(250)
    await page.screenshot({ path: `public/shots/${name}.png` }) // viewport (not fullPage) → frameable
    console.log('shot', name, '→', page.url())
  } catch (e) { console.log('FAIL', name, '—', e.message) }
}

// ── COACH (desktop) ──
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('sensei-opening-played', '1'); localStorage.setItem('korva_welcome_seen_v1', '1') } catch {} })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /sign in as a coach/i }).click({ timeout: 15000 })
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 8000 })
  await page.locator('#login-email').fill(COACH_EMAIL)
  await page.locator('#login-password').fill(COACH_PW)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  if (page.url().includes('/login')) {
    console.log('COACH LOGIN FAILED →', page.url())
  } else {
    console.log('coach in →', page.url())
    await shoot(page, '/coach/dashboard', 'coach-dashboard', 4200)
    await shoot(page, '/coach/schedule', 'coach-schedule')
    await shoot(page, '/coach/payments', 'coach-payments')
    await shoot(page, '/coach/videos', 'coach-videos')
    await shoot(page, '/coach/clients', 'coach-clients')
  }
  await ctx.close()
} catch (e) { console.log('COACH PHASE ERROR:', e.message) }

// ── STUDENT (mobile) ──
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('sensei-opening-played', '1'); localStorage.setItem('korva_welcome_seen_v1', '1') } catch {} })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /sign in as a student/i }).click().catch(async () => {
    await page.locator('[aria-label="Sign in as a student"]').click()
  })
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 8000 })
  await page.locator('#login-email').fill(CLIENT_EMAIL)
  await page.locator('#login-password').fill(CLIENT_PW)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1800)
  if (page.url().includes('/login')) {
    console.log('CLIENT LOGIN FAILED →', page.url())
  } else {
    console.log('client in →', page.url())
    await shoot(page, '/client/portal', 'student-portal')
    await shoot(page, '/client/classes', 'student-classes')
    await shoot(page, '/client/programs', 'student-programs')
    await shoot(page, '/client/videos', 'student-videos')
  }
  await ctx.close()
} catch (e) { console.log('CLIENT PHASE ERROR:', e.message) }

await browser.close()
console.log('DONE')
