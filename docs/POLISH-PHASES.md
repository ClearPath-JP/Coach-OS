# Kindo — Polish Plan (UX → UI → Security)
_Merged from the session-24 code audit + Claude Chrome live UX/UI audit (demo coach). Each item tagged
[VERIFIED] (confirmed in code), [DEMO] (demo-seed artifact, not a real-coach bug — fix perception/empty states),
or [CHECK] (needs verification during the fix). Security is intentionally LAST per owner._

> Chrome audited the DEMO account, so "fake data" findings (coach@example.com, Test Client, speech-clip.mp4,
> olivia@demo.com) are seed data, NOT bugs a real coach hits — provided onboarding populates real data and
> prospects never see the demo account.
>
> ⚠️ **Chrome's audit had a high false-positive rate (~40%) — verify each item against current code before fixing.**
> Confirmed-FALSE (already correct in code, do NOT "fix"): root `/` is 200 not 404 · `/coach/subscription` exists (307)
> · Payments period label is dynamic, NOT a hardcoded "This month" · Payments dates already use human format
> (`toLocaleDateString` month/day/year) · Leads counter is already guarded `Math.max(0, max-used)` + "Not included in
> your plan". Lesson: this codebase is in better shape than the live audit suggested; treat Chrome findings as leads,
> not facts.

---

## ✅ DONE (session 24, 2026-05-31)
- **1.1 Nav consolidation** — `8d3f218`. Added Messages/Invoices/Analytics/Subscription to the shared NAV (fixes
  desktop + mobile drawer); deleted 3 dead nav files. All 15 links browser-verified. tsc-clean.
- **1.2 Payments empty state** — `c8b56df`. "No payments in this period" vs "none ever"; "loaded"→"shown". (The
  other Payments claims were false positives — already correct.)

## 🟡 NEEDS A DECISION (not clear bugs — your call before I touch)
- **/terms + /privacy say "FoundOS" not "Kindo"** (`app/(marketing)/terms/page.tsx` L14/34/47). Nuance: FoundOS is the
  parent COMPANY, Kindo is the PRODUCT — so "use FoundOS for your coaching business" should likely be "Kindo", but
  the legal-entity line could stay. Recommend: "Kindo, a product of FoundOS ('Company'…)". Needs your wording call.
- **/browse mock directory + dead "Join Dojo" buttons** — confirmed 100% hardcoded mock coaches. Fix = either wire to
  real coaches (bigger) OR hide /browse from public nav until ready. Product decision: do you want the directory live?
- **/client/assignments redirects to portal** despite a built page — but Assignments is mid-REMOVAL by your intent
  (removed from navs). So the redirect may be intentional. Decide: finish removal (remove the lingering links) or
  restore the feature. Don't want to "restore" something you're removing.

## ⏸️ DEFERRED — do together when you're back to verify behavior live (don't blind-edit unsupervised)
- **Schedule tab refactor + Book Session modal** (1.4) — big stateful component; Chrome's claims (duplicate tabs,
  dead MONTH view, invisible client selector) need LIVE reproduction since Chrome was unreliable elsewhere.
- **Dashboard skeleton-stuck / count mismatches** (1.3) — may be the known dev-server OOM gotcha, not a real bug;
  verify on the Vercel build. Count reconciliation is query logic — verify before changing.
- **Phase 2 visual polish** — subjective; needs side-by-side visual verification with you.

---

## PHASE 1 — UX & Functional Completeness (do first; biggest "feels finished" win)

### 1.1 Nav consolidation [VERIFIED] ⭐ highest impact
Both audits + Chrome agree: Analytics, Invoices, Messages, Subscription are built but unreachable.
- `app/coach/CoachSidebarShell.tsx` — add Messages (under Clients), Invoices (Business), Analytics (Command Center/Business), Subscription (Account/footer).
- `app/coach/CoachNav.tsx` (mobile dock) — reconcile to match key desktop items.
- Retire stale legacy navs (`components/layout/coach-sidebar-nav.tsx` — used only by billing layout; `CoachMobileDock.tsx`/`MobileNav.tsx` — unused) → ONE source of truth.

### 1.2 Payments page data/copy bugs [VERIFIED]
- `PaymentsPageContent.tsx:208` — header label "This month" is hardcoded; make it reflect the selected date filter.
- Empty state "No payments recorded yet" fires on a zero-result FILTER even when all-time records exist → change to "No payments in this period."
- Period stat ($0.00 this month) vs all-time ($6,055) reads as broken → label periods clearly; show all-time as a distinct stat.
- ISO dates (2026-04-18) → human ("Apr 18, 2026"). Same on Clients/Invoices.
- "Delete" on payment rows = destructive, equal weight to Edit → add confirm + de-emphasize.

### 1.3 Dashboard reliability + correctness [VERIFIED/CHECK]
- KPI cards intermittently stuck in skeleton with no error/retry [CHECK — may be the known dev-server OOM gotcha on heavy authed routes; verify on the Vercel build, not just local]. Add a timeout + error/retry state + non-null fallback regardless.
- "3 unpaid invoices" links to /coach/payments → should link to /coach/invoices.
- Count mismatch: dashboard "3 unpaid" vs invoices page "4"; "6 needs action" vs "3 clients need engagement" → reconcile the queries.
- Revenue (month) $0 vs all-time $6,055 with no period label → clarify.

### 1.4 Schedule view bugs [VERIFIED] (high-use page)
- Two overlapping tab controls (WEEK/MONTH/AGENDA top-right + TODAY/WEEK/AGENDA below) out of sync; MONTH renders nothing → collapse to ONE control set + ship a working month view.
- "Book Session" modal: CLIENT selector invisible until Escape pressed; Cancel didn't dismiss on first click → fix modal mount/focus.
- "today" (Sun) isolated in left panel while week grid starts Mon → fix split-brain week layout.

### 1.5 /browse public directory [VERIFIED]
- `BrowseCoachesContent.tsx` = 100% hardcoded mock coaches; "Join Dojo" buttons are dead `<button>`s (no handler) → wire to real Supabase coaches + real CTA, OR hide /browse from public nav until ready. (It's the main lead-gen surface — converts zero today.)

### 1.6 Orphans / dead-ends [VERIFIED]
- `/client/assignments` redirects to portal despite a built page + links pointing to it → restore or remove links (pick one).
- Assignments mid-removal (removed from navs, page+API still exist, client links bounce) → finish removal OR restore. No half-state.
- Delete `/client/dashboard` placeholder; wire or remove `/admin/audit` stub.

### 1.7 Empty states + feature gates [VERIFIED/DEMO]
- Ensure every zero-data page has a guided empty state (Classes/Programs already do it well — copy that pattern to Videos, Payments-period, Clients).
- Videos: no direct upload button (only "Import from Google Drive") → add a file/drag-drop upload path.
- Lead Research: "Not included in your plan" warning sits above a still-usable form → lock/disable the form when gated.

---

## PHASE 2 — UI & Visual Polish (looks finished + on-brand: Brass #c8882e, Shippori Mincho + Instrument Sans, warm-dark)

### 2.1 Button hierarchy [VERIFIED] (Chrome #8)
Define + apply 3 levels everywhere: primary (brass filled), secondary (outlined, sentence case), tertiary (text). Kills the ALL-CAPS ghost CTAs ("SET AVAILABILITY") competing with filled brass ("Book Session").

### 2.2 Tag vs selected-state color collision [VERIFIED]
"VIRTUAL" tags + info badges reuse the brass = looks "selected/active." Give tags a neutral tone distinct from brass selection/CTA. (Classes, Packages.)

### 2.3 Warning vs CTA color [VERIFIED]
"Stripe not connected" / "Needs attention" use the same brass as CTAs → no hierarchy. Give warnings a distinct yellow/red.

### 2.4 Native `<select>` on Classes [VERIFIED]
Add-class-slot form uses an OS-native dropdown (breaks dark theme) → styled listbox like the tone toggle / client chips.

### 2.5 Consistency + mobile [VERIFIED/CHECK]
- Card borders/separators (Dashboard KPI band blurs together; Schedule panels merge on scroll).
- Verify each primary page at real 375px (mobile nav is thin). _Verify at actual 375px before "fixing."_
- Typography: the serif H1 ("Command Center") is used nowhere else → either adopt the serif as a system or drop it.
- Truncation: client-profile "PROGRAM" stat clips ("Mindset Reset: 4-Week Pro…"); "0/0 completed" assignments → "None assigned yet."

### 2.6 KatanaOpening overlay [CHECK]
Global splash (`components/SiteChrome.tsx`, ~780ms) reportedly flashes on scroll inside the app → confirm it's gated to fire once (sessionStorage flag) and never re-trigger in-app. (See memory `reference_katana_opening_screenshots`.)

### 2.7 Copy cleanup [VERIFIED]
`/terms` "FoundOS" → "Kindo"; kill "Sensei"/old-name leaks; `[your brand]` template literal showing in a live Settings input; MarkPaidModal "(coming soon)" Stripe option (polish or hide).

### 2.8 Landing polish [VERIFIED]
Review + commit the uncommitted session-21 landing edits; final pass (first thing a prospect sees).

---

## PHASE 3 — Security & Hardening (LAST)

1. **Rotate leaked n8n API key** — committed in `.claude/settings.local.json` (TRACKED + in history `e8e62a5`). Rotate in n8n, scrub, gitignore.
2. **Rotate `ANTHROPIC_API_KEY`** (was exposed).
3. **Prod env completeness** (Vercel `sensei-app`): `BUNNY_STREAM_*` + `REMOTION_*` (`docs/VERCEL-ENV.md`), `STRIPE_PRICE_*` (79/149/299), `UPSTASH_*` (rate-limit fails OPEN without it), `VIDEO_STREAM_TOKEN_SECRET` (video playback breaks without it), `APIFY_TOKEN`.
4. **Gate `prompt-engine/build`** — open POST today (pure templating, low risk) → add auth/rate-limit.
5. **Render robustness** — webhook or cron to reconcile `video_edits` 'rendering' rows (no crons exist; completion currently relies on the client polling). Pattern: `screenshots/check-inapp-render.mjs`.
6. **Tests** — new video-editor/Promote/leads code has ZERO coverage; add smoke/contract tests.
7. **Sentry** — confirm DSN set in prod.

---

## THEN — Ship
Merge `rebuild/v2` → `main` once Phase 1–2 land + Phase 3 essentials (env, key rotation) done. Prod is currently safe/untouched.

## Keep (what's GOOD — don't break it)
Dark + brass theme · the **Messages** page (use as the design template) · /browse coach-card composition · the Promote 3-step wizard · Classes/Programs empty states · Invoices overdue urgency · Lead "Why:" explanations.
