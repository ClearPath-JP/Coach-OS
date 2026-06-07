# ☀️ Morning Report — 2026-06-07 (overnight autonomous run)

**Branch:** `rebuild/v2` — all work **committed locally, NOT pushed, NOT deployed** (your call).
**Gates:** `npx tsc --noEmit` clean throughout · full `npm run build` **green** (122 routes) · every change spec- + code-reviewed (final consolidated review = **safe to deploy**).

---

## TL;DR
You asked to (1) lock the unfinished **Promote + Studio** tabs, (2) get a clean **founder V1** ready to deploy at **$99/mo**, and (3) prep **coach outreach**. All three are done, plus the **Studio quality engine (Phase A)** we built earlier this session (now dormant behind the lock). Nothing is deployed — you have a clean, reviewed branch to ship when you're ready.

---

## What I shipped (all on `rebuild/v2`)

### 1. 🔒 Locked Promote + Studio behind "Coming soon" (reversible)
- New `lib/feature-flags.ts` (`promote: false, studio: false`) + a polished `components/ComingSoon.tsx` panel.
- All 5 Promote/Studio routes short-circuit to the Coming-Soon panel **before any editor code runs**; nav items show a subtle **"Soon"** pill (reused your existing PRO-pill mechanism).
- **Reversible:** flip a flag to `true` to bring a tab back instantly. (commit `cf62460`)

### 2. ✨ Founder-V1 polish (audit → fixes)
I audited every core coach + client surface (static code review by 3 agents) and fixed the safe, high-confidence issues:
- **Coach surfaces** (`472daa8`): removed internal codename "Command Center"→"Schedule"; removed the "Add slot (legacy)" button; removed a duplicate/misleading "Edit" client-menu item; formatted a raw payment date; used `formatCents` for two raw `$` amounts; fixed a dead-domain fallback (`app.clearpath.com`→`coach.foundos.ai`); stopped an alarming "mark-read" error toast; replaced a native `alert()` on membership-delete with an inline error.
- **Pricing copy** (`9b63490`, display-only — no real prices touched): founding plan now says "unlimited students" (was wrongly "50"); removed 3 **unbuilt** features from the public pricing page (Access codes / Multiple dojos / API access); fixed stale `$69/$129/$199` labels → `$79/$149/$299` in the admin dropdown + catalog.
- **Client portal** (`c75470b`): replaced a native `window.confirm()` on a payment action with a proper modal; killed raw status enums shown to clients (label maps for sessions/programs/membership); fixed a phone session mislabeled "Video"; redirected a bare `/client/dashboard` stub → the real portal; humanized class-type names; host-validated a Stripe checkout redirect; removed a dev TODO comment.

### 3. 📣 Founding-coach outreach kit → `docs/outreach/`
Six ready-to-use files: `pitch-one-pager.md`, `dm-templates.md` (3 warm + 3 cold), `email-templates.md`, `demo-script.md` (60-sec + 5-min walkthrough), `objections.md`, `content-week-1.md` (7 teach-first post ideas). Tuned to solo martial-arts/fitness coaches, $99 founding offer, teach-first tone.

### 4. 🎬 Studio quality engine — Phase A (earlier this session, dormant behind the lock)
Fixed the "pixelated/squished" root causes in the render pipeline: highest-res Bunny source (was hard-capped at 720p), lossless PNG frames (was double-compressing), and per-clip fill modes (landscape now sits whole-on-black by default instead of being chopped). Spec'd Phase B (editor wizard) + Phase 4 (Meta auto-post) for later. **This only matters once Studio is unlocked** — see deploy notes.

---

## ✅ Deploy checklist — the Founder V1
1. **Push + deploy:** `git push origin rebuild/v2`, then `vercel --prod` (your manual cutover; push ≠ deploy).
2. **Sync Stripe to the displayed prices** — the *labels* now read $99 founding / $79·$149·$299. Per your own notes the actual Stripe products still need updating to match, so a coach is charged what they see. **Do this before charging anyone.**
3. That's it for V1 — the Lambda-site redeploy + HD-source / Bunny-1080p items are **NOT needed yet** because Studio is locked (no renders happen). Handle them when you unlock Studio.

---

## ⚠️ Deferred — needs you (I did NOT auto-change these)
**Auth/billing flow logic** (too risky to change without a live checkout test — precise fixes ready):
- `new-coach-activate` success redirect → `/coach/dashboard` may skip onboarding. Recommend redirect to `/onboarding` (verify the dashboard guard first).
- Post-signup verify redirect lacks `?next=/subscribe` → a coach may not reach the $99 checkout after confirming email. Recommend adding it.
- `new-coach-checkout` creates a **new Stripe customer on every retry** (no existing-customer check) → recommend mirroring the existing-coach route's lookup.
- **Verify Supabase is actually sending confirmation emails in prod** — if not, signups stall on "check your email."

**Other owner calls:**
- **Support email** appears as 3 addresses (`hello@` / `support@` / `privacy@` foundos.ai). Pick one you monitor — I didn't know which.
- **Schedule "Send invoice"** button does nothing when no invoice exists yet (modal only mounts with an existing invoiceId) — needs wiring to the QuickInvoiceModal; left for a supervised pass (complex drawer).
- **Schedule "mark complete"** uses a native `window.prompt` (feels alpha; breaks on some mobile) — left for a supervised pass (follow the existing inline-confirm pattern in that file).
- **Classes:** a legacy bookable-slots table may still render alongside the new class view — verify live it's not doubling (I only removed the legacy button).
- Minor: the `/billing`-only secondary sidebar shows "Promote" without a "Soon" pill (routes are gated anyway → lands on Coming-Soon).

---

## 🚀 Outreach — how to start (from the kit)
1. Open `docs/outreach/pitch-one-pager.md` + `demo-script.md` — that's your demo.
2. Warm first: 3–5 coaches you know → the warm DM in `dm-templates.md`, offer the **founding $99/mo-for-life** + a free try.
3. Local: martial-arts/fitness coaches in Atlanta/Marietta/Kennesaw → cold DM (teach-first) + the founding offer.
4. Post the week-1 content (`content-week-1.md`) — teach 80%, mention the tool 20%.
Goal: get **1–3 founding coaches** actually using it. That's the proof that unlocks everything.

---

## Commits (origin/rebuild/v2..HEAD, newest first)
`c75470b` portal fixes · `9b63490` pricing copy · `472daa8` coach fixes · `cf62460` lock · `b060845`→`fe7e0ed` Phase A (7) · `acebcb2`/`194584b`/`31d9694` specs+plan.

**Nothing deployed. When you're ready: push → vercel --prod → sync Stripe prices → start outreach.**
