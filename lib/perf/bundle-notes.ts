/**
 * ClearPath V2 — bundle & perf audit notes (non-executable documentation).
 *
 * Last measured: 2026-04-03 (Windows, Next 16.1.7, production `next build --webpack`).
 *
 * -----------------------------------------------------------------------------
 * HOW TO OPEN WEBPACK BUNDLE TREEMAP (ANALYZE)
 * -----------------------------------------------------------------------------
 * Default `npm run build` uses Turbopack — @next/bundle-analyzer does NOT emit reports.
 * Use:
 *   set ANALYZE=true   (PowerShell: $env:ANALYZE="true")
 *   npm run build:webpack
 * Browser tabs should open for client + server bundles.
 *
 * -----------------------------------------------------------------------------
 * FIND 1 — Single chunks > ~200kb gzipped
 * -----------------------------------------------------------------------------
 * Measured on `.next/static/chunks/*.js` via gzip of file bytes (not brotli):
 *   NO chunk exceeded 200 kB gzip. After Phase 6 Part B (analytics charts → `next/dynamic`):
 *   - 105.1 kB gzip / 353.5 kB raw — 6907.*.js (still contains recharts when that async chunk loads)
 *   - 61.0 kB gzip / 193.8 kB raw — 4bd1b696-*.js (shared app/vendor)
 *   - 58.5 kB gzip / 185.3 kB raw — framework-*.js (React runtime)
 *   - 50.1 kB gzip / 184.2 kB raw — 3794-*.js
 *   - 40.8 kB gzip / 147.8 kB raw — 5536-*.js
 *   - 38.7 kB gzip / 110.0 kB raw — polyfills-*.js
 *   - 37.1 kB gzip / 127.4 kB raw — main-*.js
 *
 * Note: “Largest chunk” counts every emitted client chunk. Recharts is code-split (assignments +
 * admin revenue were already dynamic; analytics revenue + payment charts now use dynamic in
 * `AnalyticsPageContent`). `/coach/dashboard` does not import recharts; the 6907.* chunk loads only
 * when a route pulls a chart bundle.
 *
 * -----------------------------------------------------------------------------
 * FIND 2 — Server-only libraries in the client bundle
 * -----------------------------------------------------------------------------
 * Stripe SDK (`lib/stripe.ts`) and Supabase server helpers (`lib/supabase-server.ts`,
 * `lib/supabase/service.ts`) are guarded with `import 'server-only'`. Grep: no `use client`
 * module imports the Node Stripe SDK.
 *
 * -----------------------------------------------------------------------------
 * FIND 3 — Duplicated modules across chunks
 * -----------------------------------------------------------------------------
 * Inspect treemap after ANALYZE build. Recharts: dynamic in `AssignmentsPageContent`,
 * admin revenue page, and per-chart dynamic imports inside `AnalyticsPageContent` (targets
 * `AnalyticsChartsPanel`). Smaller chunks (e.g. 3498.*, 4282.*) hold related async stubs; 6907.* is
 * the heavy recharts vendor slice when loaded.
 *
 * -----------------------------------------------------------------------------
 * FIND 4 — Largest 5 dependencies (by bundle contribution, approximate)
 * -----------------------------------------------------------------------------
 * 1. recharts — ~105 kB gzip in largest chunk (see FIND 1)
 * 2. react / react-dom — framework-*.js + shared bundles
 * 3. next / app shared — main-*.js, 4bd1b696-*.js, route chunks
 * 4. polyfills — polyfills-*.js (~39 kB gzip) when included for target browsers
 * 5. Other route vendors — 3794-*.js, 5536-*.js (mixed UI/libs; confirm in treemap)
 *
 * -----------------------------------------------------------------------------
 * npm / lockfile (2026-04-03)
 * -----------------------------------------------------------------------------
 * If `npm install` throws `Cannot read properties of null (reading 'matches')` (npm 11 +
 * arborist), a common cause is a pnpm-style `node_modules/.pnpm` tree. Fix: delete `node_modules`,
 * then `npm install` to generate `package-lock.json` and a flat npm tree.
 * `npm dedupe` was run after install (removed 1 package, 735 packages audited).
 *
 * -----------------------------------------------------------------------------
 * Fonts (Part B5)
 * -----------------------------------------------------------------------------
 * Root layout uses `next/font/google` (DM Sans). `app/globals.css` still `@import`s Inter/Sora;
 * `:root` font tokens are frozen by project rules — full self-host needs coordinated `:root` update.
 *
 * -----------------------------------------------------------------------------
 * Lighthouse (Part B7)
 * -----------------------------------------------------------------------------
 * Targets: Performance ≥85, A11y ≥90, BP ≥95, SEO ≥80 on /coach/dashboard.
 * Automated CLI (Lighthouse 13, HeadlessChrome on localhost) failed with NO_FCP / NO_LCP on this
 * environment — typical for some Windows/headless setups. For real scores: Chrome DevTools →
 * Lighthouse while logged in as a coach on http://localhost:3000/coach/dashboard (or deployed URL).
 * Unauthenticated /coach/dashboard may redirect — scores reflect the shell you actually paint.
 *
 * -----------------------------------------------------------------------------
 * A11y — automated / moderate issues
 * -----------------------------------------------------------------------------
 * Conversation sidebar search: focus ring via `box-shadow`. Modal: role="dialog", aria-modal,
 * aria-labelledby. Further axe issues: record after local Lighthouse.
 *
 * -----------------------------------------------------------------------------
 * Security / rate limiting (Part D4)
 * -----------------------------------------------------------------------------
 * `lib/rate-limit` + Upstash used on many routes including `/api/auth/login`.
 */

export {}
