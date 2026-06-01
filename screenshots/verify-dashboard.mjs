// Verify the coach dashboard renders (KPIs resolve, no console errors) + invoice link target.
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
await page.goto(BASE + '/coach/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })

// KPIs must resolve out of skeleton: a StatCard label should be visible.
// Dev server is slow (8-15s API + cold compile); give it room — prod is fast.
const ok = await page.getByText('Active clients', { exact: false }).first().isVisible({ timeout: 90000 }).catch(() => false)
console.log(ok ? '[PASS] KPI cards rendered (out of skeleton)' : '[FAIL] KPIs never resolved')

// If an unpaid-invoices attention chip exists, confirm it points to /coach/invoices.
const chip = page.getByRole('link', { name: /unpaid invoice/i }).first()
if (await chip.count()) {
  const href = await chip.getAttribute('href')
  console.log(href === '/coach/invoices' ? `[PASS] invoice chip → ${href}` : `[FAIL] invoice chip → ${href}`)
} else {
  console.log('[INFO] no unpaid-invoice chip on this account (none pending) — link change still applied in code')
}
console.log(errs.length ? '[FAIL] ' + errs.join(' | ') : '[PASS] no page errors')
await page.screenshot({ path: 'screenshots/verify-dashboard.png' })
await browser.close()
