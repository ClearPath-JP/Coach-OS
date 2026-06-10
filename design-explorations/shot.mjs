// Screenshot harness for the Korva design explorations.
// Usage:  node design-explorations/shot.mjs [dir-slug]
//   no arg  -> screenshots every NN-* direction folder
//   dir-slug-> only that one (e.g. 01-dojo-nightfall)
// For each <dir>/*.html it writes <dir>/shots/<name>-desktop.png and -mobile.png
import { chromium } from 'playwright'
import { readdirSync, statSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

// Resolve relative to THIS file (design-explorations/), not the process cwd —
// so the harness works no matter where node is invoked from.
const ROOT = dirname(fileURLToPath(import.meta.url))

// Validate the optional filter arg: it may only be a direction slug like "01-dojo-nightfall".
// Reject anything else so it can never be used for path traversal.
const only = process.argv[2]
if (only !== undefined && !/^\d\d-[a-z0-9-]+$/.test(only)) {
  console.error(`Invalid dir slug: ${JSON.stringify(only)} (expected e.g. 01-dojo-nightfall)`)
  process.exit(1)
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const dirs = readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && statSync(join(ROOT, d)).isDirectory())
  .filter((d) => !only || d === only)
  .sort()

let count = 0
const failures = []
let browser
try {
  browser = await chromium.launch()
  for (const d of dirs) {
    const dir = join(ROOT, d)
    const shotsDir = join(dir, 'shots')
    if (!existsSync(shotsDir)) mkdirSync(shotsDir, { recursive: true })
    const htmls = readdirSync(dir).filter((f) => f.endsWith('.html')).sort()
    for (const html of htmls) {
      const url = pathToFileURL(join(dir, html)).href
      const name = basename(html, '.html')
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        })
        const page = await ctx.newPage()
        // Force fresh reads of the local HTML/CSS on every shot — Chromium otherwise
        // caches file:// resources, so edits between re-renders wouldn't show.
        // Best-effort: never let a CDP hiccup crash the run.
        try {
          const cdp = await ctx.newCDPSession(page)
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        } catch { /* cache stays on; not fatal */ }
        try {
          // Read the HTML fresh AND inline theme.css. Chromium aggressively caches
          // file:// resources (including the linked stylesheet), so an external
          // <link href="theme.css"> can serve a STALE theme across re-renders.
          // Inlining the freshly-read CSS as a <style> defeats that completely.
          let freshHtml = readFileSync(join(dir, html), 'utf8')
          const cssPath = join(dir, 'theme.css')
          if (existsSync(cssPath)) {
            const css = readFileSync(cssPath, 'utf8')
            freshHtml = freshHtml.replace(/<link[^>]*href=["']theme\.css["'][^>]*>/i, '<style>\n' + css + '\n</style>')
          }
          await page.setContent(freshHtml, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
            await page.setContent(freshHtml, { waitUntil: 'load', timeout: 30000 })
          })
          // let Tailwind Play CDN JIT + web fonts + entrance animations settle
          await page.waitForTimeout(1600)
          const out = join(shotsDir, `${name}-${vp.name}.png`)
          await page.screenshot({ path: out, fullPage: true })
          count++
          console.log('  shot', d, `${name}-${vp.name}`)
        } catch (e) {
          failures.push(`${d}/${name}-${vp.name}: ${e.message}`)
          console.log('  FAIL', d, `${name}-${vp.name}`, e.message)
        } finally {
          await ctx.close().catch(() => {})
        }
      }
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {})
}
console.log(`DONE — ${count} screenshots` + (failures.length ? `, ${failures.length} failures` : ''))
if (failures.length) failures.forEach((f) => console.log('   x', f))
