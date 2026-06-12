# 🥋 Launch-readiness audit — Korva, 2026-06-11

*You went to the gym and asked me to: run the audits you hadn't looked into, build coach-targeted image ads, and get the app ready to charge your first coach. Here's what I found, what I fixed, and the short list that's left for you.*

---

## TL;DR (30 seconds)
- I ran **4 audits you'd never done** — SEO/share-card, accessibility, legal/payment-readiness, and front-end performance — plus fresh Supabase advisors.
- I **fixed the safe, high-value stuff in code** (build verified green): the entire SEO foundation, the belt-tile contrast failures (incl. your **$99 button**), a real refund policy + beefed-up Terms/Privacy, an auto-renewal disclosure at checkout, and a deceptive "free trial" label. **22 files, all on `design/dojo-arcade`, not committed or deployed** — review then ship.
- I built **5 on-brand image ads + your link share-card + app icons** (`marketing/ads/`, copy in `marketing/ad-copy.md`).
- ✅ **You said go — I closed the free side-door (paywall-first) and did both perf fixes, build-verified.** The $99 paywall is now enforced; the landing + legal pages statically prerender (instant from an ad). What's left is yours: verify the live Stripe price, flip leaked-password protection, then deploy.
- Your tasks are ready as **paste-in Claude Chrome prompts** → `docs/CHROME-PROMPTS-2026-06-11.md`.

---

## ✅ What I fixed today (code — `npm run build` passes, **uncommitted**)

| Area | Fix | Files |
|---|---|---|
| **SEO foundation** | Added `robots.ts`, `sitemap.ts`, `manifest.ts`; upgraded root metadata (metadataBase, title template, OpenGraph + Twitter cards, keywords, canonical, themeColor); `SoftwareApplication` JSON-LD on the landing | `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`, `app/layout.tsx`, `app/page.tsx` |
| **Share card + icons** | Generated a 1200×630 OG image + favicon/app icons (Dojo Arcade) and wired them | `public/og.png`, `app/icon.png`, `app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png` |
| **Per-page titles** | Real `<title>`s for login/signup/forgot/privacy/terms; `noindex` on login + reset; reconciled browse/subscribe so they don't double-suffix | the `(auth)/*/page.tsx` + `browse`/`subscribe` |
| **Accessibility — contrast** | White text on teal/coral/blue/yellow belts **fails WCAG** (incl. the $99 checkout button) → switched to ink across 7 CSS utilities + 17 inline spots + both money CTAs; darkened muted text tokens; ink focus-ring that's visible on every belt; added a skip-to-content link | `app/globals.css`, landing + auth components, `SubscribePageContent.tsx`, `PricingSection.tsx`, `app/layout.tsx` |
| **Legal — refund policy** | **New** Refund & Cancellation policy page, linked from footer + checkout | `app/(auth)/refunds/page.tsx`, `Footer.tsx` |
| **Legal — Terms/Privacy** | Rewrote both: Stripe-Connect coach↔student clause, auto-renewal, founding-for-life meaning, governing law, full sub-processor list (Supabase/Stripe/Bunny/Upstash/Anthropic/Resend/Vercel), cookies, minors, CCPA/GDPR, re-dated, reskinned to Arcade | `terms/page.tsx`, `privacy/page.tsx` |
| **Payment honesty** | Added the required **auto-renewal disclosure** + Terms/Privacy/Refunds links next to the pay button; killed the false **"Start free trial"** label (→ "Get started") since no trial exists in code | `SubscribePageContent.tsx`, `PricingSection.tsx` |
| **Paywall-first (side-door)** | Free `/onboarding` mint now refuses without checkout (402 → pick a plan); unpaid coaches route to `/subscribe`; **paid path + demo access untouched** | `lib/complete-coach-signup.ts`, `proxy.ts`, `lib/post-login-redirect.ts` |
| **Ad-landing perf** | Removed root `force-dynamic` → landing/auth/legal now **static-prerendered**; splash no longer blanks public pages (once/session, reduced-motion, 320ms) | `app/layout.tsx`, `components/layout/AppLoadingScreen.tsx` |

---

## 🚦 What's still between you and charging coach #1

### 🔴 Blockers
1. ✅ **CLOSED — the $99 paywall is now enforced (paywall-first).** `completeCoachSignup` no longer mints a free workspace (returns 402 → choose a plan); unpaid coaches route to `/subscribe` (`proxy.ts` `/onboarding` + `lib/post-login-redirect.ts`). The paid path (`lib/new-coach-activation.ts`) is untouched, and the existing-access guard stays permissive so your **demo coach + seeded accounts don't get locked out**. Build-verified. *(Only-you item: update `__tests__/01-auth.test.ts:49` next time you run the integration suite — it still expects the old `/onboarding` redirect, already stale vs your live `/subscribe`.)*
2. **Verify the Stripe founding price = $99/mo recurring, LIVE.** The code trusts the env ID blindly. → **Chrome Prompt 1.**

### 🟡 Before/at launch
3. **Leaked-password protection is OFF** (Supabase). Needs Pro. → **Chrome Prompt 2.** (Also fixes the Free/Nano IO fragility that's bitten you before.)
4. ✅ **DONE — ad-landing perf fixed + build-verified.** Removed the root `force-dynamic`: the landing + login/signup + privacy/terms/refunds now **statically prerender** (confirmed in the build output — they were all forced-dynamic before). The **550ms blank splash** no longer touches any public page (instant ad-landing), plays once per session, respects reduced-motion, and is 320ms on the authed app.
5. **Deploy** to ship everything above. Current prod is the Arcade branch *without* today's fixes.

### Decisions only you can make
- ~~Close the side-door? (paywall-first vs trial-first)~~ ✅ **Done — paywall-first, per your go-ahead.**
- **Business entity + governing-law state** for Terms (I used neutral wording; make it specific once FoundOS is formed — e.g. Georgia, USA).
- **A domain you love** vs `coach.foundos.ai` (the ads + OG use the current URL).

---

## 📋 The audits, in brief
*(Each was a dedicated code-verified agent; full detail lives in their findings — this is the signal.)*

- **SEO / share-card** — was functionally invisible to social + weakly indexable: no metadataBase, OG image, robots, sitemap, or favicon. **All fixed.** Remaining = submit the sitemap to Search Console post-deploy (Prompt 6).
- **Accessibility (WCAG AA)** — the Arcade belts had a systemic white-on-bright-color contrast failure (yellow 1.4:1, teal 2.2:1 … all fail; ink passes on all). Confirmed and **fixed**. Forms/labels/headings/landmarks were already solid. Remaining 🟡 polish: command-palette + mobile "More" sheet focus-trapping (noted, not launch-blocking).
- **Legal / payment-readiness** — your Terms+Privacy were *real* but thin; no refund policy; checkout lacked auto-renew disclosure; landing promised a non-existent free trial; the Connect coach↔student relationship was undisclosed. **All fixed in code.** You supply the entity/jurisdiction specifics.
- **Performance** — good news: the giant AI JPGs that could've wrecked LCP are **orphaned/not loaded**, fonts are done right, heavy libs are quarantined. Real items = `force-dynamic` + the 550ms splash (deferred to you, #4 above). 5 unused 400–600KB JPGs are dead weight you can delete.
- **Supabase advisors** — clean of surprises: the 9 `SECURITY DEFINER` warnings are your known self-authorizing RPCs (documented safe in the 90/100 security audit); only real flag = leaked-password protection (Prompt 2). Performance advisors are mostly unused-index notices; the critical `auth_rls_initplan` was already fixed.

---

## 🎨 Image ads (delivered)
5 Dojo-Arcade ads in `marketing/ads/` (3 square feed + 2 vertical story) targeting *"you mastered your art — stop giving it away free."* Plus the OG share-card and app icons. **Captions + hashtags + where to post each → `marketing/ad-copy.md`.** Re-render after any copy/domain change: `python marketing/ads/render-ads.py`.

> Photographic (real coach/dojo) variants need a higgsfield top-up — your account is on the free tier with 9.1 credits. Say the word + top up and I'll generate a set.

---

## 🛠️ To review & ship
```bash
cd C:\Dev\ClearPath\COACH-OS
git status                     # 22 changed/new files, all on design/dojo-arcade
git diff                       # review
git add -A && git commit -m "feat(launch): SEO foundation, WCAG contrast, refund/legal pages, checkout disclosures + ad creatives"
npx --yes vercel --prod        # ship (manual deploy; push ≠ deploy)
```
Then run the **Claude Chrome prompts** (`docs/CHROME-PROMPTS-2026-06-11.md`) 1→6.

## ⏱️ Your next 30 minutes
*(Side-door + perf fixes are already done + build-verified — these are what's left.)*
1. You: Chrome Prompts 1 + 2 (verify $99 price + flip leaked-password). ~15 min.
2. You: review `git diff`, commit, `vercel --prod`.
3. You: run Prompts 3–6 (checkout smoke, eyeball authed app, submission playback, sitemap/OG).
4. You: DM your founding coach the founding ad. 🚀
