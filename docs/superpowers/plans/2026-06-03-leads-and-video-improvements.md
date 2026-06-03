# Leads & Video — Reliability & Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tier 1 is execute-ready; Tiers 2–3 need a design pass (flagged inline) before they get their own detailed plans.

**Goal:** Close the reliability gaps and ship the highest-value improvements in the two newest, most complex COACH-OS features — Lead Research / Local Scout (`/coach/leads`) and the Promote → Video editor — surfaced by the 2026-06-03 code audits.

**Architecture:** Both features share one root flaw: a long external job (Apify scrape + 2 Claude calls; or a Remotion Lambda render) runs synchronously in the request, can exceed the serverless timeout, and leaves a DB row stuck in a non-terminal state (`pending` / `rendering`) with no scheduled reconcile and no cost ceiling. The plan is tiered: (1) safe quick-wins, (2) a shared reliability pattern — *return fast → poll → scheduled reconcile → spend cap*, (3) product features that need design decisions first.

**Tech Stack:** Next.js 16 App Router (route handlers), Supabase (service-role writes), Vercel Cron, Upstash rate-limit, Anthropic Sonnet, Apify (Instagram hashtag scraper), Bunny Stream, Remotion Lambda (AWS us-east-1).

**Source audits:** video + lead-search code audits run 2026-06-03 (findings inlined below). **Current state:** all V2 work merged to `main` (`70336b9`) and deployed to prod (`coach.foundos.ai`).

---

## File map (what each tier touches)

| Tier | Area | Primary files |
|---|---|---|
| 1 | Cron schedule | `vercel.json` |
| 1 | CSV safety | `app/coach/leads/leads-csv.ts` |
| 1 | Dead-button honesty | `app/coach/leads/LeadsTable.tsx`, `app/coach/leads/LeadDetailDrawer.tsx` |
| 1 | Cross-tenant write | `app/api/coach/leads/interaction/route.ts` |
| 2 | Async lead search | `app/api/coach/leads/search/route.ts`, `app/coach/leads/CoachLeadsContent.tsx`, new `app/api/cron/reconcile-lead-searches/route.ts` |
| 2 | Render hardening | `app/api/cron/reconcile-renders/route.ts`, `app/api/coach/promote/render/route.ts` |
| 2 | Apify resilience + telemetry | `lib/lead-research.ts`, `app/api/coach/leads/search/route.ts` |
| 2 | Spend ceiling | new `lib/spend.ts`, `lib/plan-limits.ts`, admin surface |
| 3 | Video Phase 3 | `lib/remotion.ts`, `app/api/.../render/status/route.ts`, `app/coach/promote/promote-shared.tsx`, `remotion/CaptionedClip.tsx` |
| 3 | Leads pipeline CRM | `app/coach/leads/*`, `lib/leads-interactions.ts` |

---

# TIER 1 — Safe quick-wins (execute-ready, low-risk, S-effort)

Each is independent and reversible. Recommended as one batch → one commit each → one deploy → verify.

### Task 1: Schedule the render-reconcile cron

**Why:** `app/api/cron/reconcile-renders/route.ts` exists but `vercel.json` has **no `crons` key**, so Vercel never invokes it. Renders that finish after the client poll budget (or after the coach closes the tab) stay `rendering` forever with no recovery UI. (Audit video-🔴 H1.)

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the cron entry**

```json
{
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "regions": ["iad1"],
  "crons": [
    { "path": "/api/cron/reconcile-renders", "schedule": "0 * * * *" }
  ]
}
```

> Hourly (`0 * * * *`) is Hobby-safe. `*/15` requires Vercel Pro — only switch if the plan is Pro. The route already requires `Authorization: Bearer $CRON_SECRET`.

- [ ] **Step 2: USER — add `CRON_SECRET` to Vercel** (Production) if not already set. Generate: `openssl rand -hex 32`. (Confirm via `vercel env ls production | grep CRON_SECRET`.)
- [ ] **Step 3: Verify the route auth locally** — `curl -s localhost:3000/api/cron/reconcile-renders` should 401 without the bearer; with `-H "Authorization: Bearer <secret>"` it should 200 with a JSON summary.
- [ ] **Step 4: Commit** — `git commit -m "fix(video): schedule reconcile-renders cron (hourly) so stuck renders recover"`

### Task 2: CSV formula-injection guard on lead export

**Why:** `leads-csv.ts` RFC-4180-quotes fields but a scraped value beginning with `= + - @` executes as a formula when the CSV opens in Excel/Sheets. Lead data is untrusted third-party scrape output. (Audit leads-🟡, Medium.)

**Files:**
- Modify: `app/coach/leads/leads-csv.ts` (the `quoteCsvField` helper)
- Test: throwaway `scripts/_check-csv.ts` (repo `jest` is integration-only; use a `npx tsx` check, then delete)

- [ ] **Step 1: Write the failing check**

```ts
// scripts/_check-csv.ts
import { quoteCsvField } from '../app/coach/leads/leads-csv'
const cases: [string, boolean][] = [
  ['=cmd|...', true], ['+1', true], ['-2', true], ['@SUM', true], ['normal', false],
]
for (const [input, dangerous] of cases) {
  const out = quoteCsvField(input)
  const guarded = out.startsWith("'") || out.startsWith('"\'')
  if (dangerous && !guarded) throw new Error(`UNGUARDED: ${input} -> ${out}`)
  if (!dangerous && guarded) throw new Error(`OVER-GUARDED: ${input} -> ${out}`)
}
console.log('csv guard OK')
```

- [ ] **Step 2: Run it, watch it fail** — `npx tsx scripts/_check-csv.ts` → throws `UNGUARDED: =cmd…`
- [ ] **Step 3: Implement the guard** — in `quoteCsvField`, before quoting, prefix a leading `'` to any value whose first char is one of `= + - @ \t \r`:

```ts
function quoteCsvField(value: string): string {
  let v = value ?? ''
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v   // neutralize spreadsheet formula injection
  // ...existing RFC-4180 quoting unchanged...
}
```

- [ ] **Step 4: Run the check** — `npx tsx scripts/_check-csv.ts` → `csv guard OK`
- [ ] **Step 5: Delete the throwaway + commit** — `rm scripts/_check-csv.ts` then `git commit -m "fix(leads): guard CSV export against spreadsheet formula injection"`

### Task 3: Ship-or-hide the dead "Find email" button

**Why:** "Find email" is hardcoded disabled / "Coming soon" in **two** places on a paid feature — clutter + erodes trust. Decision for this tier: **hide it** (reversible; build later if we wire enrichment). (Audit leads-🟡 product / High-honesty.)

**Files:**
- Modify: `app/coach/leads/LeadsTable.tsx` (~`:298-306`)
- Modify: `app/coach/leads/LeadDetailDrawer.tsx` (~`:505-513`)

- [ ] **Step 1:** In both files, remove (or wrap in `{false && ( … )}` with a `// TODO: re-enable when email enrichment ships` comment) the disabled "Find email" / "Coming soon" control.
- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; load `/coach/leads`, open a lead drawer + the table row actions → no "Find email" button, no layout gap.
- [ ] **Step 3: Commit** — `git commit -m "chore(leads): hide non-functional Find email control until enrichment ships"`

### Task 4: Validate `saved_client_id` ownership in the interaction route

**Why:** `app/api/coach/leads/interaction/route.ts` writes `saved_client_id` via the **service client** (bypasses RLS) accepting any UUID — a coach could link a lead to another workspace's client id (cross-tenant FK write). (Audit leads-🟡 security, Low-Med.)

**Files:**
- Modify: `app/api/coach/leads/interaction/route.ts` (the PATCH handler, before the upsert ~`:41-69`)

- [ ] **Step 1: Add the ownership check** — when `savedClientId` is present, confirm it belongs to `workspaceId` before writing:

```ts
if (parsed.savedClientId) {
  const { data: owned } = await admin
    .from('clients')
    .select('id')
    .eq('id', parsed.savedClientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!owned) {
    return NextResponse.json({ error: 'Client not found in this workspace' }, { status: 403 })
  }
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; existing save-to-client flow still links normally (the happy path passes a real workspace client id).
- [ ] **Step 3: Commit** — `git commit -m "fix(leads): validate saved_client_id belongs to the coach workspace"`

### Task 5: Fix the `[YourTown]` hashtag placeholder leak (HIGH — ships broken hashtags publicly)

**Why:** Promote generates hashtags like `#[YourTown]bjj` that go verbatim into the copy buffer — a coach pasting into Instagram posts the literal placeholder. Root cause: `lib/promote-content.ts` prompts ask for "mostly-local tags" and reference "the coach's town" (`:91, :163, :180, :231`) but the coach's real city is **never injected** into the prompt, so the model emits bracketed placeholders. (Chrome live-audit video-🟡, top priority.)

**Files:**
- Modify: `lib/promote-content.ts` (the 4 prompt builders)
- Modify: `app/api/coach/promote/generate/route.ts` (+ the video-plan route) to fetch + pass the coach's city
- **Design fork:** confirm where coach location lives (grep workspace/profile/onboarding for city/location/area). If no city field exists: either (a) prompt-guard only, or (b) capture the coach's town once in settings and thread it through.

- [ ] Step 1: Locate the coach city/area in the data model.
- [ ] Step 2: Thread `city` into the prompt builders + append: "Use the coach's real city in local hashtags. NEVER output bracketed placeholders like [YourTown] or [City]. If the city is unknown, use non-localized tags instead."
- [ ] Step 3: Verify in-browser — generate a video plan + an idea post; assert zero `[`/`]` in hashtags, real city when known.
- [ ] Step 4: Commit — `git commit -m "fix(promote): inject coach city + forbid bracketed placeholders in generated hashtags"`

### Task 6: Open the lead detail drawer scrolled to top

**Why:** The drawer opens at the bottom (AI Outreach Draft) instead of the top (name/status/actions), forcing a scroll-up every open. (Chrome live-audit leads-🟡.)

**Files:** Modify `app/coach/leads/LeadDetailDrawer.tsx`

- [ ] Step 1: Add a `ref` to the scroll container; in a `useEffect` keyed on the open lead id, `el?.scrollTo(0, 0)`.
- [ ] Step 2: Verify — open several leads; each starts at the header.
- [ ] Step 3: Commit — `git commit -m "fix(leads): open lead drawer scrolled to top"`

### Task 7: Clarify the "0 / 0 searches" free-tier counter

**Why:** Free tier shows "0 / 0 searches left this month" — reads like a math error, not "not in your plan." (Chrome live-audit leads-🟡.)

**Files:** Modify `app/coach/leads/CoachLeadsContent.tsx` (quota display)

- [ ] Step 1: When `maxLeadSearchesPerMonth === 0`, render "Lead Research is a Pro feature — upgrade to search" instead of "0 / 0 searches left".
- [ ] Step 2: Verify — free demo coach sees upgrade copy; a Pro plan still shows "N / M searches left".
- [ ] Step 3: Commit — `git commit -m "fix(leads): clearer free-tier lead-search quota messaging"`

### Tier 1 close-out
- [ ] Stop dev server, run `npm run build` (must be green), restart dev.
- [ ] `vercel --prod` (dedup makes re-uploads small/fast now), health-check `coach.foundos.ai/api/health`.
- [ ] Merge `rebuild/v2` → `main` (ff) + push.

---

# TIER 2 — Reliability batch (M-effort; lock the approach before building)

> **Design fork to confirm first:** the async pattern can be (A) Vercel-native — return the `pending`/`rendering` row immediately, do the work in `after()` / a fire-and-forget task, client polls the existing GET, plus a cron reconciles stale rows; or (B) offload to a queue / n8n worker. **Recommend (A)** — no new infra, mirrors what render already does with `after()`, and the cron backstop is the same pattern as Tier 1 Task 1. Confirm A vs B, then this tier gets a full TDD plan.

### 2a — Async + reconcilable lead search
- **Problem:** `app/api/coach/leads/search/route.ts` runs the whole pipeline (2 Claude + 20–120s Apify) inside POST → can exceed the function timeout → row stuck `pending` forever, permanent "Searching…" spinner, spend already incurred. (Audit leads-🔴 High.)
- **Change:** insert the `pending` row and return its id immediately; run `runLeadResearch` in `after()`; have `CoachLeadsContent` poll the GET list endpoint until the row is `done`/`failed` (reuse the render poll pattern in `VideoEditor.tsx`). Add `app/api/cron/reconcile-lead-searches/route.ts` (CRON_SECRET-gated) to flip `pending` rows older than ~3 min → `failed`. Add its `vercel.json` cron entry.
- **Files:** `app/api/coach/leads/search/route.ts`, `app/coach/leads/CoachLeadsContent.tsx`, new cron route, `vercel.json`.

### 2b — Harden the render path
- **Stranded kickoff:** a render whose `after()` dies before setting `remotion_render_id` is skipped by the reconcile cron (`.not('remotion_render_id','is',null)`) → permanent `rendering`. Extend the cron to also fail rows that are `rendering` + `remotion_render_id IS NULL` + older than ~5 min. (Audit video-🟡 M1.)
- **Double-render guard:** `render/route.ts` inserts a new row + fires a Lambda on every click → double AWS cost. Short-circuit if an in-flight `rendering` row exists for the same `source_video_id`. (Audit video-🟡.)
- **Files:** `app/api/cron/reconcile-renders/route.ts`, `app/api/coach/promote/render/route.ts`.

### 2c — Apify resilience + founder telemetry
- **Problem:** Apify errors bubble to a generic "Search failed" with no handling for 402/403/quota and no founder signal — and Apify is on the **FREE plan** in prod, so the flagship Pro feature will silently break at the cap. (Audit leads-🔴 High.)
- **Change:** detect Apify quota/auth failures in `scrapeInstagramHashtags`, return a distinct user message ("Lead search is temporarily unavailable — we've been notified"), and emit a founder alert (log + existing error-report path / email). Move `APIFY_TOKEN` from the URL query string to an `Authorization: Bearer` header, and add a hard `maxItems` cap so `posts.length`-based cost can't balloon. (Audit leads-🟡 security/cost.)
- **Files:** `lib/lead-research.ts`, `app/api/coach/leads/search/route.ts`.
- **USER op:** upgrade the Apify plan before relying on this in prod.

### 2d — Shared monthly spend ceiling + visibility
- **Problem:** `cost_cents` is written per lead search (and render cost is implicit) but never summed, capped, or surfaced; the rate-limiter fails **open** if Redis is down. Count caps exist; dollar caps don't. (Audit leads-🟠 Med-High.)
- **Change:** a small `lib/spend.ts` that sums workspace spend for the current month across `lead_searches.cost_cents` (and, later, render cost), enforced as a hard stop in the search route regardless of plan count caps; surface a one-line monthly-spend figure in the admin overview.
- **Files:** new `lib/spend.ts`, `app/api/coach/leads/search/route.ts`, `lib/plan-limits.ts`, admin overview surface.

---

# TIER 3 — Product sprint (L-effort; needs brainstorming/design first)

> Each item below has a real product/design decision. When you pick one, we run superpowers:brainstorming to lock the design, write a dedicated detailed plan, then build. Listed in recommended value order.

### 3a — Video Phase 3: close the loop (render → Bunny → composer)
The render is currently a dead-end download (`VideoEditor.tsx`); the schema already has an **unused `output_guid` column** flagging this was the plan. On render `done`, re-upload the S3 output to Bunny (or the videos library), store `output_guid`, and surface the finished clip in the step-3 `ResultActions` (`promote-shared.tsx`) **next to the AI caption** — so the coach leaves Promote with clip + caption ready to post. *This is the whole point of the feature.* **Design fork:** post directly vs. save-to-library vs. schedule.

### 3b — 16:9 cover-fit + caption anchoring
`remotion/CaptionedClip.tsx:64` `OffthreadVideo` has no `objectFit` → landscape sources become a thin letterboxed band, and captions (pinned 220px from frame bottom) strand in the black bar. Add a `fit: 'cover' | 'contain'` prop (default **cover**) + a "Fill / Fit" toggle in `VideoEditor`, and anchor captions to a % of the video region. **S–M effort**, high output-quality win — could be pulled forward into Tier 2 if desired.

### 3c — Editor UX wins
Thumbnail/scrubber strip under a dual-thumb trim range (Bunny exposes `thumbnail.jpg`); live client-side caption-style **preview** over the poster frame (see TikTok vs Minimal before paying for a render); **editable caption text** (cues already in state — fix Whisper mistakes pre-burn-in). **Design fork:** how much editor vs. keep it one-tap.

### 3d — Unified leads pipeline CRM
Today each search is a siloed result set; the same person reappears across searches as separate rows. A single pipeline board (New → Contacted → Replied → Converted) across all searches turns one-off searches into an ongoing CRM — far more useful for a 20-client solo coach. **L-effort, design-heavy.** Also fold in: persist dismissed leads (today "delete" is ephemeral client-side hide), make bulk "Add to clients" real or remove it, show the structured search summary instead of the verbose auto-composed query, and either populate or drop the always-null `bio`/`followers` claims.

---

## 2026-06-03 Chrome live-audit — finding map
Live audit of `coach.foundos.ai` confirmed the deploy healthy (Task-1 all PASS; Anthropic key rotation verified via Promote). Remaining findings slotted as:
- **New → Tier 1:** `[YourTown]` hashtag leak (T5), drawer opens at bottom (T6), "0 / 0" quota copy (T7).
- **Confirms code audit → Tier 2:** "failed" searches with no user explanation → 2c (Apify/error handling); storage bar stuck at "0.00 / 5 GB" despite uploads → 2d/L1 (Promote uploads never send `file_size_bytes`); "Find email" gating ambiguity → T1.3 (now hidden).
- **Deferred → Tier 3 (video):** black library thumbnails (generate Bunny thumb at ~1s), identical "speech-clip.mp4" names (auto-name on upload), "copy just hashtags" button, estimated Reel duration in the plan, partial regenerate (hook/caption only), "Use in Promote" button on the library card, 9:16 preview pane.
- **Deferred → Tier 3 (leads UX, 3d):** restore last search inputs, "Why" hover tooltip, note-save toast, "Next lead →" in drawer, individual-vs-partner grouping, in-drawer outreach tone toggle, follower/engagement signal, batch outreach generation.

## Recommended sequence
1. **Tier 1** now (4 quick-wins, one deploy).
2. **Tier 2c + 2a** next (Apify resilience + async lead search) — this is the launch-blocking reliability for the paid Local Scout feature.
3. **Tier 2b + 2d** (render hardening + spend ceiling).
4. **Tier 3b** (cover-fit — cheap, big quality win), then **3a** (video Phase 3).
5. **Tier 3d / 3c** as deliberate product work.

## Open ops items (USER, not code)
- Finish the **Stripe webhook events** for the membership test (`customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`).
- **Revoke the old `ANTHROPIC_API_KEY`** once Promote AI is confirmed working on the new key.
- **Upgrade the Apify plan** before relying on lead search in prod.
- Decide on **`app.foundos.ai`** (point its DNS at Vercel as primary, or drop the alias).
- Add an **S3 lifecycle rule** to expire rendered video outputs (cost).
- Verify the **Bunny URL sign scheme** (Basic vs V2) so renders don't 403 if token-auth is enabled.

---

## Self-review notes
- **Coverage:** every 🔴/🟠 from both audits maps to a task (video H1→T1.1, leads async→T2a, Apify→T2c, spend→T2d, letterbox→T3b, Phase 3→T3a; 🟡 security → T1.2/T1.4/T2c). 
- **Tier 1 is the only execute-ready section** — Tiers 2–3 intentionally stop at scope+approach because they carry design forks; do not implement them from this doc without the per-item plan.
