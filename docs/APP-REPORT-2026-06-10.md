# ☀️ Morning Report — Korva, 2026-06-10

*You went to the gym and asked me to: deploy the design, audit coach + admin + client, make the UI components clean, and come back to a report + a score + a call on the name. Here it is.*

---

## TL;DR (the 30-second version)

- **Your app is in genuinely good shape.** Overall **86/100 (B+)** — launch-ready for your first founding coach, held back only by a few polish items and **3 things only you can decide/verify** (Stripe price, the signup funnel, the email-confirm setting).
- **I did NOT push the Dojo Arcade design to production** — on purpose. What you love is a set of *mockups*, not the wired app. "Deploying" it = a real reskin **+ new gamification backend** (streaks/XP/belts), i.e. a multi-day build, not a one-click deploy. Doing that to a live, about-to-charge app while you're unreachable would've been reckless. Full reasoning below — and a clean path to actually ship it.
- **I cleaned the UI you asked about.** The biggest *visible* bug was brass-colored buttons leaking into the client portal (which is supposed to use each coach's chosen color). Fixed that + 5 other brand/copy inconsistencies. Build still green.
- **The audits found that your 2026-06-09 pre-launch fixes are real and held** — every 🔴 data-loss/money bug from that pass is genuinely fixed in the current code. What's left is polish, not breakage.
- **Name: keep Korva.** Decisive recommendation below. The name isn't your bottleneck; shipping is.

---

## Scoreboard

| Surface | Score | One-line verdict |
|---|---:|---|
| **Coach app** | 88/100 | Solid, on-brand, all the bad bugs fixed; remaining items are honesty/polish |
| **Money / Auth** | 88/100 | The $99 path is now safe to take real money; 3 owner-gated items remain |
| **Admin** | 86/100 | Authorization airtight, every mutation audit-logged; a couple of safety gaps |
| **Client portal** | 78 → ~84/100 | 7 prior fixes held; I fixed the one glaring brand leak (the 78 was mostly that) |
| **Build / Lint** | ✅ / minor | Production build compiles 100% clean; 9 lint errors, all low-severity |
| **Overall** | **86/100 (B+)** | Ready to charge coach #1 once you clear the 3 owner gates |

Why not higher: native browser `alert()`/`confirm()` dialogs still appear on ~14 paths (incl. the subscription/checkout screen), a Light/Dark theme toggle is advertised but doesn't work, the signup funnel contradicts itself, and the Stripe founding price hasn't been human-verified. None are hard blockers — but a sharp coach would notice the seams.

---

## 1. The deploy question — why I held, and how to actually ship Dojo Arcade

**What you love (Dojo Arcade) is a mockup gallery**, not the running app. Here's the honest gap:

- Your **current live app** (coach.foundos.ai) is fully wired: auth, Stripe, Supabase, every feature. It wears the **dark + brass "Dojo Nightfall"** brand.
- **Dojo Arcade** is two things stacked: (a) a **full visual reskin** — bright cream, belt-colored cards, thick borders, hard shadows; and (b) **net-new product** — the streaks, XP, belt-journey, and medals (especially the client portal). (b) needs real **data + backend** (tracking attendance streaks, XP rules, per-coach belt definitions) — that's not styling, it's a feature build, and it would touch the database (which your rules say I must ask you about first).

So "deploy that" honestly means: **reskin the real surfaces + build the gamification engine + verify + deploy.** Ballpark: the **landing** could be reskinned fast (1–2 days, mostly static, and it converts harder than today's sparse dark hero). The **full gamified portal** is more like **1–2 weeks** because of the backend.

**Recommended path (incremental, low-risk):**
1. **Lock the direction.** You clearly love Arcade. My honest read: Arcade is *perfect* for the **client portal** (the gamification is your retention moat — students will *want* to open it). For the **coach side + landing**, Arcade is bolder than my earlier "premium" instinct, but for *your* ICP (solo garage/park/virtual coaches, not corporate buyers) the energy probably resonates *more* than restraint. I'm on board with full-Arcade — optionally a slightly "premium-ed up" Arcade for the coach app if you want to hedge.
2. **Ship the new landing first** as a quick, visible win while the portal is built behind it.
3. **Spec → build on `rebuild/v2` → verify → deploy → DM your founding coach.**

When you're back and say the word, I'll write the spec and start. This is a great direction — I just won't fake-ship a mockup as if it's the product.

---

## 2. Audit findings by surface

> Legend: 🔴 broken/launch-blocker · 🟡 fix before charging · 💡 later. Every item is code-verified at file:line by a dedicated agent.

### Coach app — 88/100
**Verified fixed & held** (the 2026-06-09 batch was real): availability no longer deletes class slots (C1), "Send invoice"/"Complete session" actions work (C2/C3), classes don't double-render (C4), testimonials 500 gone (W1), honest leads/gating copy (C10), Stripe-not-connected warnings on passes+memberships (C11), payments show formatted dates (C9), support email converged on hello@foundos.ai.

**Still open:**
- 🟡 **Native `alert()` on the subscription/checkout screen** (`SubscriptionPageContent.tsx:132,134,149,151`) — the one money surface coach #1 must cross. Replace with the in-app banner pattern.
- 🟡 **Light/Dark theme is advertised but broken** — `ThemeProvider.tsx:17` force-darks on every load, so the picker at `settings/appearance/page.tsx` reverts. Either make it work or remove the picker. *(I fixed the misleading copy that referenced it — see §3.)*
- 🟡 **14 native `confirm()` dialogs on destructive actions** (worst: delete-client `ClientsPageContent.tsx:246`). The inline-confirm modal pattern already exists to copy.
- 💡 Command palette shows fake "B/C/M/P" shortcuts that aren't wired; `/coach/assignments` renders a half-built page by direct URL (nav-hidden only); Passes reuses the Packages icon.

### Money / Auth — 88/100 — *safe to charge real money for the founding flow*
**Verified fixed:** M1 (pay-$99 no longer a black hole — webhook idempotently activates the coach even if the redirect is lost), M2 (subscribe page surfaces errors so nobody double-pays), M3 (no-profile coaches can still log back in to pay), M5 (founding counter is real), M6 (failed money-fulfillment now forces Stripe to retry), M8 (membership double-subscribe is caught + the dupe cancelled).

**Open — see Owner Gates (§6):** M4 (verify the Stripe price), M9 (funnel contradiction + free side door), email-confirm handler gap.
- 🟡 New: the **subscribe page glow was hardcoded crimson** (off-brand) — *I fixed it to brass (see §3).*

### Admin — 86/100
Authorization is **airtight** — every admin API + page is guarded, every mutation is audit-logged. Empty states are real, no secrets leak to the UI.
- 🟡 `clear-test-sessions?deleteAll=true` deletes **all** sessions across **all** workspaces with no prod guard — add a `NODE_ENV` block or typed-confirm.
- 🟡 The **Audit page is a "Coming soon" stub** sitting on top of a fully-built `/api/admin/audit` route — wire it up or hide the nav entry.
- 🟡 "Sign in as coach" impersonation has **no confirm** (Suspend does) — add one (it's already audit-logged).

### Client portal — 78 → ~84/100 (after my fix)
**Verified fixed & held:** covered-booking-shown-as-error (#1), mobile booking path (#2), post-purchase pass polling (#4), expired-credit filtering (#6), the UTC "good morning at night" greeting bug (#7).
- 🔴→✅ **Brass buttons in the indigo portal** — the headline cleanliness bug. *Fixed (see §3).*
- 🟡 Booking coverage is opaque: pass/membership holders are told "Book & pay $X" then sometimes 403'd after tapping — the API should return whether a booking is covered. *(Reported, not fixed — needs an API change.)*
- 🟡 Invoice "Pay by card" skips the `checkout.stripe.com` allowlist that every other money button has — cheap hardening.

---

## 3. UI cleanliness — what I cleaned (and what I left for you)

You said "make sure the UI components are clean." The dominant theme was **brand-token consistency** (your own rule: brass for coach, each coach's accent for the client portal). I applied a **focused, reversible, build-verified** batch on this branch (**not deployed**):

| Fix | File | What changed |
|---|---|---|
| **Client portal brass leak** (the big one) | `globals.css` + `client/layout.tsx` | Added a scoped `.cp-scope` token bridge so shared buttons/surfaces inside the client portal use the coach's chosen color, not brass. Zero coach-side impact. |
| Coach-chrome accent leak | `SettingsPageContent.tsx` | Settings active-tab + link now use brass `--accent`, not the leaked workspace color. |
| Off-brand crimson glow | `SubscribePageContent.tsx` | $99 card glow changed crimson → brass. |
| Platform page mis-themed | `admin/not-authorized/page.tsx` | Cream/client-accent → dark + brass to match admin chrome. |
| Misleading theme copy | `SettingsPageContent.tsx` | Removed the "use the sun/moon toggle" claim (no such toggle) and the wrong "brand sapphire" (it's brass). |
| Mobile nav truncation | `MobileNav.tsx` | "Membership" clipped to "Members!" at 375px → relabeled "Plan". |

**One honesty note:** I could not *visually* render these without running the app against your live Free/Nano database (which an audit once knocked offline). The **build passes**, so they compile and the tokens resolve — but please give the client portal + subscribe page a 30-second eyeball on a local run before you deploy them. The token-bridge is the one to glance at; the rest are trivially safe.

**Left for you (deliberately not auto-fixed):** the 14 `confirm()`/`alert()` dialogs (bulk UI work, better reviewed), the broken Light/Dark picker (a remove-vs-build decision), and the booking-coverage API change (needs a backend tweak). All are in §2.

---

## 4. Build & lint health

- **Production build: ✅ clean** — every route compiles, no type errors.
- **Lint: 9 errors, 32 warnings — all low-severity.** 7 errors are the strict new `react-hooks/set-state-in-effect` rule firing on *intentional* SSR-safe mount patterns (`PortalLocalDate`, `KatanaOpening`, Studio components); 1 is a trivial `prefer-const`; 1 is a `refs-during-render` in the Studio editor (which is feature-flagged OFF). Most warnings are unused vars, several in throwaway scripts. **None block the build or deploy.** Worth a 30-minute cleanup pass someday, not now.

---

## 5. The name — should "Korva" stay, or keep thinking?

**My recommendation: keep Korva. Stop renaming. Ship.**

Reasoning, honestly:
- **It's already shipped** — deployed to prod, wordmark done (KOR + brass VA), and it's already your *third* name (Sensei → Kindo → Korva). A fourth change burns momentum and reads as indecision to anyone watching.
- **It's ownable.** Invented = trademarkable + SEO-clean. My checks: no prominent software/brand collision exists for "Korva," and your records show the only US trademark hit is an unrelated *pickleball paddle* (different class — low conflict). That's a *good* position.
- **It's a fine word.** Short, 5 letters, pronounceable, modern -a ending (cf. Okta, Vanta, Miro). "KOR" reads a little like "core," and it has a vaguely martial/Japanese sound that fits the dojo theme without boxing you into martial arts as you expand to other coaching niches.
- **Transparency:** "korva" means **"ear"** in Finnish (also "handle"). Irrelevant and harmless for your US coaching audience — not embarrassing, just trivia. Not a reason to change.

**The real point:** your bottleneck isn't the name — it's getting coach #1 paying. Names matter *far* less than product + first customer. The two cheap things worth finishing (already in motion): (1) let the **attorney's USPTO clearance** come back clean, and (2) **lock a domain you can live with**. Then never reopen this. If you *only* keep thinking about one thing, make it the funnel (§6), not the name.

---

## 6. Owner gates — only you can do these (before charging)

1. **Verify the founding Stripe Price = $99/mo recurring, LIVE mode.** The code trusts the env ID blindly (`lib/stripe.ts:19`). This is the literal thing that charges coach #1 — eyeball it in the Stripe dashboard.
2. **Decide the signup funnel (M9).** Today it's contradictory: a free `/onboarding` side door mints a 14-day-trial workspace that bypasses the $99 paywall, and once a free workspace exists, `/subscribe` is unreachable. Pick **paywall-first** (gate onboarding behind an active subscription) or **trial-first** (restore honest trial copy). I can implement either fast once you choose.
3. **Confirm Supabase email-confirmation is OFF in prod** (or I'll add a `/auth/confirm` handler) — there's no in-app exchange route today, so a verify-on-signup coach could stall before reaching checkout.
4. *(Carryover)* Stripe platform identity verification — still blocks live money regardless of the above.

---

## 7. If I had your next hour, I'd do this (in order)

1. You: clear gates #1–#3 above (15 min in dashboards + one funnel decision).
2. Me: replace the subscription-screen `alert()` + the delete-client `confirm()` with the in-app pattern (the two a coach actually hits).
3. Me: ship the **new Arcade landing** as a fast visible win.
4. Me: spec + build the **gamified Arcade client portal** (the retention moat) on `rebuild/v2`.
5. You: DM your founding coach "let's start." 🚀

---

*Audits by 3 parallel code-verified agents (coach / client / admin+money) against the current branch. Build + lint run locally. UI fixes committed to `design/overnight-explorations`, not deployed. Nothing was pushed to production.*
