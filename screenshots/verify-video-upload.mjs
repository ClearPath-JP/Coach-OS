import { chromium } from '@playwright/test'
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 1000 } })
await ctx.addInitScript(() => { try { sessionStorage.setItem('sensei-opening-played', '1') } catch {} })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message))
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: /sign in as a coach/i }).click()
await page.locator('#login-email').fill('coach@example.com')
await page.locator('#login-password').fill('Demo123!')
await page.getByRole('button', { name: /^sign in$/i }).click()
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 })
await page.goto(BASE + '/coach/videos', { waitUntil: 'domcontentloaded', timeout: 60000 })

const btn = page.getByRole('button', { name: /upload video/i }).first()
const btnVisible = await btn.isVisible({ timeout: 60000 }).catch(() => false)
console.log(btnVisible ? '[PASS] "Upload video" button visible' : '[FAIL] no Upload video button')
if (btnVisible) {
  await btn.click()
  const heading = await page.getByText('Upload a video', { exact: false }).first().isVisible({ timeout: 5000 }).catch(() => false)
  const fileInput = await page.locator('input[type="file"][accept="video/*"]').count()
  console.log(heading ? '[PASS] uploader modal opens' : '[FAIL] modal did not open')
  console.log(fileInput > 0 ? '[PASS] file input present (accept=video/*)' : '[FAIL] no file input')
  await page.screenshot({ path: 'screenshots/verify-video-upload.png' })
}
console.log(errs.length ? '[FAIL] ' + errs.slice(0, 3).join(' | ') : '[PASS] no page errors')
await browser.close()
