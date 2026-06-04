# Tier 2 — Reliability Hardening (Lead Search + Render) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (same as Tier 1). Steps use checkbox (`- [ ]`) syntax. This is the execution-ready slice of the broader roadmap (`docs/superpowers/plans/2026-06-03-leads-and-video-improvements.md`). It **deliberately excludes** the async lead-search refactor (Tier 2a) — that needs a platform decision first (see "Decide before Tier 2a" at the bottom).

**Goal:** Make lead search safe to run on the FREE Apify plan in prod — no silent breakage, no founder blind spot, no runaway cost — and stop the render path from stranding rows or double-billing. **Zero architectural change, zero schema change.**

**Architecture:** Pure hardening of existing routes. (2c) `lib/lead-research.ts`: Bearer-header the Apify token, hard-cap returned items, classify quota/auth/down failures; `search/route.ts` surfaces a distinct user message + a founder log. (2b) the reconcile cron also fails stranded kickoffs; the render route guards against a double-fire.

**Tech Stack:** Next.js route handlers, Supabase service client, Apify (`run-sync-get-dataset-items`), Anthropic, Vercel Cron (daily on Hobby).

**Source:** 2026-06-03 lead-search + video-editor code audits.

> **Before editing any file, confirm the current line numbers / variable names** — the audit's refs may have drifted, and several of these files are large.

---

## File map
| Task | File | Concern |
|---|---|---|
| 1 | `lib/lead-research.ts` (`scrapeInstagramHashtags`) | Bearer token + hard item cap |
| 2 | `lib/lead-research.ts` | classify Apify quota/auth/down failures |
| 3 | `app/api/coach/leads/search/route.ts` | distinct user message + founder log |
| 4 | `app/api/cron/reconcile-renders/route.ts` | reconcile stranded render kickoffs |
| 5 | `app/api/coach/promote/render/route.ts` | double-render guard |

Verify with `npx tsc --noEmit` after each task; do **not** run `next build` mid-task (controller runs it at close-out). One commit per task. End every commit message with the `Co-Authored-By` trailer.

---

### Task 1: Apify token → Bearer header + hard `maxItems` cap

**Why:** the token is currently passed in the URL query string (leaks via logs/proxies), and the returned dataset is uncapped → cost (`posts.length × ~$0.0019`) can balloon. Capping also shortens the pipeline (fewer accounts to classify), a prerequisite mitigation for the Tier-2a timeout.

**Files:** Modify `lib/lead-research.ts` (the `scrapeInstagramHashtags` function).

- [ ] Step 1: Move the token from the URL query string to an `Authorization: Bearer ${process.env.APIFY_TOKEN}` request header on the Apify `fetch`.
- [ ] Step 2: Hard-cap results: pass Apify's `maxItems` (run-sync option / query param) AND defensively `.slice(0, CAP)` the returned posts before the cost calc. Use the existing constants (`MAX_HASHTAGS` × `RESULTS_PER_HASHTAG`) — confirm their exact names in the file.
- [ ] Step 3: `npx tsc --noEmit` — clean.
- [ ] Step 4: Commit: `fix(leads): Bearer-auth Apify + hard item cap (prevent token leak + cost blowup)`

### Task 2: Classify Apify quota / auth / down failures

**Why:** today any `!res.ok` throws a generic error → the user sees "Search failed" and the founder gets no signal. On the FREE plan, hitting the cap silently kills the flagship Pro feature.

**Files:** Modify `lib/lead-research.ts`.

- [ ] Step 1: Define + export a typed error:
```ts
export class LeadSearchUnavailableError extends Error {
  constructor(message: string, public reason: 'apify_quota' | 'apify_auth' | 'apify_down') {
    super(message)
    this.name = 'LeadSearchUnavailableError'
  }
}
```
- [ ] Step 2: In `scrapeInstagramHashtags`, on `!res.ok`, branch on `res.status`: `401|403` → `'apify_auth'`; `402|429` → `'apify_quota'`; else `'apify_down'`. Throw `LeadSearchUnavailableError` with the reason; include the first ~200 chars of the response body in the message (for logs).
- [ ] Step 3: `npx tsc --noEmit` — clean.
- [ ] Step 4: Commit: `feat(leads): classify Apify quota/auth/down failures`

### Task 3: Distinct user message + founder telemetry in the search route

**Why:** turn the classified failure into (a) a clear, non-generic user message and (b) a founder-visible log. Failed searches already don't consume a credit — keep that.

**Files:** Modify `app/api/coach/leads/search/route.ts`.

- [ ] Step 1: In the `catch` around `runLeadResearch`, detect `instanceof LeadSearchUnavailableError`. For it: `console.error('[LEAD_SEARCH_UNAVAILABLE]', err.reason, err.message)` (recognizable for Vercel logs / alerting), mark the `lead_searches` row `failed`, and return **503** with `{ error: "Lead search is temporarily unavailable — we've been notified. No search was used." }`. All other errors keep the existing generic 502 path.
- [ ] Step 2: Check for an existing admin-notify path (`app/api/error-report`, `lib/report-frontend-error.ts`); if one exists, optionally fire it — otherwise the tagged `console.error` is sufficient for v1.
- [ ] Step 3: `npx tsc --noEmit` — clean.
- [ ] Step 4: Commit: `feat(leads): distinct "temporarily unavailable" message + founder log on Apify failure`

### Task 4: Reconcile stranded render kickoffs

**Why:** a render whose `after()` died before setting `remotion_render_id` is skipped by the cron's `.not('remotion_render_id','is',null)` filter → stuck `'rendering'` forever, invisible to poll and cron.

**Files:** Modify `app/api/cron/reconcile-renders/route.ts`.

- [ ] Step 1: After the existing reconcile pass, add a second query: `video_edits` where `status = 'rendering'` AND `remotion_render_id IS NULL` AND `created_at < (now − 5 min)` → update those to `status='failed'`, `error='Render did not start — please try again'`.
- [ ] Step 2: `npx tsc --noEmit` — clean.
- [ ] Step 3: Commit: `fix(video): reconcile cron fails stranded render kickoffs`

### Task 5: Double-render guard

**Why:** clicking "Render" twice inserts two `video_edits` rows and fires two Lambda renders = double AWS cost.

**Files:** Modify `app/api/coach/promote/render/route.ts`.

- [ ] Step 1: Before inserting the new `video_edits` row, query for an in-flight one: `status='rendering'` AND `source_video_id = <this>` AND `workspace_id = <this>` (newest first). If found, return `{ editId: existing.id }` (200) instead of inserting + firing a new Lambda render.
- [ ] Step 2: `npx tsc --noEmit` — clean.
- [ ] Step 3: Commit: `fix(video): guard against double render for the same source clip`

---

## Close-out
- [ ] Stop the dev server, `npm run build` → green, restart dev.
- [ ] Dispatch a `reviewer` subagent over the diff (spec compliance + bugs/security); fix loop until APPROVED.
- [ ] Deploy: `vercel --prod` (retry loop) → `curl coach.foundos.ai/api/health` → ff-merge `rebuild/v2` → `main` + push.
- [ ] Spot-check in prod: trigger a lead search with a deliberately bad `APIFY_TOKEN` scenario is hard to force — instead confirm the happy path still returns leads, and that the render double-click returns the same `editId`.

## Decide before Tier 2a (async lead search) — DO NOT build 2a from this plan
Lead search runs synchronously in the POST, and the Apify pipeline can take ~120s — but **Hobby functions cap at ~60s `maxDuration`**, so a slow search already risks a hard timeout (stuck `pending`, no reconcile). Pick one before building 2a:
- **(A) Stay sync, force the pipeline < ~60s** — Task 1's item cap + fewer hashtags + tighter Apify/Claude budgets. Cheapest; risks thinner results.
- **(B) Vercel Pro** → `export const maxDuration = 300` + return-fast + `after()` + client poll + a `reconcile-lead-searches` cron. Cleanest async; costs the Pro plan (also unlocks sub-daily render reconcile).
- **(C) External worker / queue** (n8n or an Apify webhook) → fully decoupled. Most robust, most work.

Recommend **(B) if upgrading to Pro anyway**, else **(A)** as a stopgap. Tier 2d (monthly spend ceiling + visibility) layers on after whichever is chosen.

## Self-review
- **Coverage:** Apify token-in-URL + uncapped cost (T1), no quota/auth handling (T2), generic error + no founder signal (T3), stranded render kickoff (T4), double-render cost (T5) — all map to audit findings. The async/timeout + spend-ceiling items are explicitly deferred with a decision gate.
- **No placeholders / no schema changes / no async refactor** in the execute-ready tasks.
- **Type consistency:** `LeadSearchUnavailableError` (defined T2) is the same symbol caught in T3.
