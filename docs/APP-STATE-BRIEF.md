# Kindo / COACH-OS — Master State Brief
_Snapshot: 2026-05-31 (session 24). Paste this to brief Claude Chrome or a fresh Claude session._

## What it is
**Kindo** (codebase "COACH-OS") — a multi-tenant SaaS for solo martial-arts & fitness coaches. One tool replacing 5: client tracking, session notes, check-ins, scheduling, billing, messaging, content/marketing. Target: **78 Pro coaches @ $129/mo = $10k MRR**.

## Stack
Next.js 16.1.7 (App Router, Turbopack, React 19) · Supabase (Postgres + RLS + Storage, 66 migrations) · Stripe (Subscriptions + Connect + Customer Portal) · Bunny Stream (video) · Remotion on AWS Lambda (render) · Anthropic Claude (AI) · Apify (IG leads) · Upstash Redis (rate limit) · Resend (email) · Sentry. Deploys on **Vercel** (project `sensei-app`).

## Size / maturity
~76k LOC · 52 pages · 164 API routes · 248 components · 66 DB migrations. Type-clean (tsc 0 errors). **~85% built — the core is real (DB+API wired), not cosmetic.**

## Where the code lives  ⚠️ READ THIS
- **Production** = `main` = **coach.foundos.ai**. Tip `dfe377c`. Does **NOT** have the video editor / Promote wizard / leads rebuild.
- **`rebuild/v2`** = `3c5de31`, **17 commits ahead of main, 0 behind** (clean fast-forward). ALL recent work is here. Pushed → Vercel builds a **preview URL** (find it in the Vercel dashboard → sensei-app → Deployments → latest rebuild/v2).
- Working tree is **dirty** (~165 uncommitted: session-21 landing edits + screenshots/docs). Not deployed.
- **Demo coach login:** `coach@example.com` / `Demo123!`
- Local dev: `npm run dev` → http://localhost:3000

## What's REAL (DB + API wired, verified)
Coach: dashboard · schedule (1:1 booking, availability, ICS) · classes (Stripe pay-to-secure) · clients (+detail) · programs (module editor) · packages · payments · invoices · messaging (threads + broadcast) · videos (Bunny + Drive import) · analytics · settings (branding/white-label) · subscription (Stripe Connect payouts). Client portal: XP/levels, daily check-in, programs, goals, sessions, invoices, messages. Admin: overview, coach mgmt, magic links. Promote: Idea + Chat AI paths. Leads: Apify+Claude engine. **Video editor: built + verified end-to-end this session (local + AWS Lambda + signed Bunny + in-app route).**

## The ~15% GAP (prioritized — these are the "polish" targets)
1. **Nav inconsistency (BIGGEST):** the live coach sidebar (`app/coach/CoachSidebarShell.tsx`) OMITS **Analytics, Invoices, Messages, Subscription** — all 4 are fully built but unreachable except by URL. Mobile dock (`CoachNav.tsx`) is even more minimal. Three different navs disagree.
2. **`/browse`** (public coach directory) = **100% hardcoded mock coaches** (`BrowseCoachesContent.tsx`). Customer-facing fake data.
3. **`/client/assignments`** = `redirect('/client/portal')` despite a fully-built page + nav links pointing to it (regression).
4. **`/client/dashboard`** = orphaned "Welcome to your portal" placeholder.
5. **`/admin/audit`** = "Coming soon" stub (but `/api/admin/audit` exists).
6. **Assignments** = mid-removal: removed from all navs, but coach page + full API still exist; client links bounce to portal. Decide: finish removal or restore.
7. **`/terms`** body still says "FoundOS" not "Kindo".
8. Stripe-as-payment-method in `MarkPaidModal` = disabled "(coming soon)".
9. Video render = 503 until Vercel env vars set (in progress; see `docs/VERCEL-ENV.md`).

## Cost to run
Scales to zero. Today (~0 users): **$0–20/mo**. Early (5–10 coaches): **$45–95/mo**. At $10k MRR: **$150–400/mo (<5% of revenue)**. Mostly pay-per-use (AI ~$0.01–0.05/gen, Lambda render ~$0.01–0.05, Bunny pennies/GB). Only fixed: Apify ($49 if used heavily) + platform tiers.

## Security posture (good; fix these — Phase 3)
Clean overall: `.env` gitignored, no hardcoded app secrets, service-role client server-only, auth on all mutating routes, signed webhooks, tight CSP. **Fix later:** (a) **n8n API key (JWT) is committed** in `.claude/settings.local.json` (tracked + in history `e8e62a5`) — rotate + scrub; (b) rotate `ANTHROPIC_API_KEY` (was exposed); (c) `prompt-engine/build` is open/un-rate-limited (pure templating, low risk); (d) rate-limit fails OPEN if `UPSTASH_*` unset; (e) video playback breaks if `VIDEO_STREAM_TOKEN_SECRET` unset; (f) Stripe Price IDs may be unset in prod.

## Plan
See `docs/POLISH-PHASES.md` — Phase 1 UX → Phase 2 UI → Phase 3 Security (last).
