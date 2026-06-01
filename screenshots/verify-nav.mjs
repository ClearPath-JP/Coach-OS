// Verify the consolidated coach sidebar shows all expected links.
import { chromium } from '@playwright/test'
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
await ctx.addInitScript(() => { try { sessionStorage.setItem('sensei-opening-played', '1') } catch {} })
const page = await ctx.newPage()
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: /sign in as a coach/i }).click()
await page.locator('#login-email').fill('coach@example.com')
await page.locator('#login-password').fill('Demo123!')
await page.getByRole('button', { name: /^sign in$/i }).click()
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 })
await page.goto(BASE + '/coach/dashboard', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const want = ['Dashboard', 'Schedule', 'Classes', 'Clients', 'Messages', 'Promote', 'Lead research', 'Programs', 'Packages', 'Payments', 'Invoices', 'Analytics', 'Videos', 'Subscription', 'Settings']
const results = []
for (const label of want) {
  const count = await page.locator('aside').getByRole('link', { name: label, exact: true }).count()
  results.push(`${count >= 1 ? '✓' : '✗ MISSING'} ${label}`)
}
console.log(results.join('\n'))
const missing = results.filter((r) => r.includes('MISSING')).length
console.log(missing === 0 ? '\nALL NAV LINKS PRESENT ✓' : `\n${missing} MISSING`)
await page.screenshot({ path: 'screenshots/verify-nav.png' })
await browser.close()
