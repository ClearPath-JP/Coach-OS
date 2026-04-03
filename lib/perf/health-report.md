# ClearPath V2 — Health Score Report

Updated: 2026-04-03

## Bundle (webpack build, gzip)

| Chunk                | Before  | After   | Delta  |
|----------------------|---------|---------|--------|
| Largest chunk (6907.*) | 105.1 kB | 105.1 kB | — (async recharts vendor; not on `/coach/dashboard` first paint) |
| recharts             | in 6907.* | split via dynamic imports | Analytics + assignments + admin load charts on demand |
| framework            | 58.5 kB | 58.5 kB | —      |

`npm run build:webpack` + gzip of `.next/static/chunks/*.js`. The on-disk largest chunk is unchanged because webpack still emits a ~105 kB gzip async slice for recharts; coach dashboard and other non-chart routes do not import it until a chart route loads.

## Code Quality

| Metric                  | Count | Target | Status |
|-------------------------|-------|--------|--------|
| TypeScript errors       | 0     | 0      | 🟢     |
| @ts-ignore / expect-err | 0     | 0      | 🟢     |
| console.log (non-catch, app/components/lib `*.ts`/`*.tsx`) | 0 | 0 | 🟢 |
| API routes missing catch| 0     | 0      | 🟢     |
| API routes missing auth | —     | —      | 🟡     |

Auth: handlers use `requireCoach`, `requireClient`, `assertAdminApi`, `supabase.auth.getUser()`, signed tokens, or are intentionally public. A naive `grep` for `getServerSession|auth()|session|public-ok` does not match this codebase; spot-check public routes (e.g. `/api/health` → `public-ok` comment).

## Coverage

| Item                    | Have  | Target | Status |
|-------------------------|-------|--------|--------|
| Error boundaries        | 4     | 4      | 🟢 (`app/error.tsx`, `app/coach/error.tsx`, `app/client/(main)/error.tsx`, `app/admin/error.tsx`) |
| not-found.tsx           | yes   | yes    | 🟢 (`app/not-found.tsx`) |
| Suspense on dashboard   | yes   | yes    | 🟢 (`app/coach/dashboard/page.tsx` wraps `CoachDashboardWithProfile`) |

## Knip / deps (Phase 6 Part C)

| Item | Notes |
|------|--------|
| Unused files (knip) | ~18 reported (many false positives, e.g. barrel files, portal components); verify before delete per safety rules |
| Packages removed    | 5 (`@radix-ui/react-slot`, `date-fns-tz`, `react-big-calendar`, `node-fetch`, `ts-node`) — not referenced in app/components/lib |

## Lighthouse (manual — run in Chrome DevTools while logged in)

| Category       | Score | Target |
|----------------|-------|--------|
| Performance    | TBD   | ≥ 85   |
| Accessibility  | TBD   | ≥ 90   |
| Best Practices | TBD   | ≥ 95   |
| SEO            | TBD   | ≥ 80   |

**How to get Lighthouse scores**

1. `npm run dev`
2. Open Chrome → sign in as coach
3. Navigate to `/coach/dashboard`
4. DevTools (F12) → Lighthouse tab
5. Mode: Navigation, Device: Desktop
6. Categories: Performance, Accessibility, Best Practices, SEO
7. Run analysis → paste the four scores above

## Deferred (Phase 7 candidates)

- [ ] Conversation list virtualization (> 100 students)
- [ ] Rate limiting on auth routes
- [ ] Error tracking service (Sentry or equivalent)
- [ ] Admin surface slate-* → cp-* token migration
- [ ] Lighthouse scores (manual, requires browser session)
- [ ] Knip-unused files: confirm references, then delete or barrel-export
- [ ] Optional: `knip` ignore for `lib/perf/bundle-notes.ts` (documentation-only module)

## Overall Assessment

Bundle size on disk remains healthy (no chunk over 200 kB gzip), and recharts is now loaded only through explicit `next/dynamic` paths for analytics charts, assignments, and admin revenue. Coach layout parallelizes independent Supabase work (`profiles`, workspace id, headers, then subscription + workspace), and every `app/api/**/route.ts` handler is wrapped in `try/catch`. Five unused npm packages were removed after repository grep. TypeScript is clean under strict settings. Next priorities: run Lighthouse while authenticated, then triage knip’s unused-file list with grep before deleting anything.
