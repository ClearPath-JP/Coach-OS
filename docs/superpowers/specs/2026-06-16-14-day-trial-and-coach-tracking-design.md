# 14-Day Free Trial → $99/mo Auto-Convert + Founding-Coach Tracking

**Date:** 2026-06-16
**Status:** Approved (owner said "run it" 2026-06-16)
**Branch:** `design/dojo-arcade` (current prod branch)

## Problem / Goal
Korva is live on korvacoach.com and charge-ready, but the model is **paywall-first**: a new
coach pays $99 immediately. To land the first founding coach (Terrance — warm, known in person)
with minimal friction and zero awkward "are you going to pay" follow-up, switch the founding offer
to a **14-day free trial that auto-converts to $99/mo** with a card on file. Owner does
outreach/DMs; Claude maintains a tracking ledger.

## Decision (owner, 2026-06-16)
**Card on file, auto-converts.** Coach enters card at signup → 14 days free → Stripe auto-charges
$99/mo on day 15 unless cancelled. (Rejected: no-card concierge trial — would require manual
chasing + manual conversion.)

## Key finding: the stack is already trial-ready
- `subscriptions` table has `trial_ends_at` + a `'trialing'` status.
- `lib/new-coach-activation.ts` already accepts `subscriptionStatus: 'trialing'` + `trialEndsAt`.
- `proxy.ts:371` already admits `status === 'trialing'` (and any future `trial_ends_at`) into `/coach/*`.
- Stripe webhook already records `trialing` for new-coach checkouts (`route.ts:369-380`) **and**
  flips `trialing → active` on conversion via `customer.subscription.updated` (`route.ts:552-573`).
- Checkout success guards already tolerate a trial's `payment_status: 'no_payment_required'`
  because `session.status === 'complete'`.

So **no schema, no webhook, no proxy, no RLS changes.** Three small code edits + copy + an optional banner.

## In scope — implementation

### 1. Start the trial (core) — `app/api/billing/new-coach-checkout/route.ts`
- Add `const TRIAL_PERIOD_DAYS = 14`.
- Add `subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS }` to `stripe.checkout.sessions.create(...)`.
- Do **not** set `payment_method_collection: 'if_required'` — leave Stripe's default (`always`) so
  the card IS collected up front (required for auto-conversion).
- Applies to all plans via the constant; only `founding` is sold now → effect is "founding coaches
  get 14 days free, then $99/life."

### 2. Honest status on the redirect path — `app/api/billing/new-coach-activate/route.ts`
- Line 71 currently hardcodes `subscriptionStatus: 'active'`. Replace with a read of the
  already-expanded `stripeSubObj.status`, mapped `trialing → 'trialing'`, `active → 'active'`, else
  `'past_due'` (mirrors the webhook). Falls back to `'active'` only if the subscription object is
  somehow absent.
- `trialEndsAt` is already derived correctly (lines 61-63) — no change.

### 3. Honest trial copy
- `/subscribe`: primary CTA → "Start your 14-day free trial"; inline disclosure → "Free for 14
  days. Then $99/mo, billed monthly. Cancel anytime." (Update the existing auto-renewal disclosure
  wording; do not remove it.)
- `/terms`: add one sentence — a 14-day free trial precedes the first charge; card is collected at
  signup; cancelling during the trial means no charge.

### 4. (Recommended) Dashboard trial banner
- A small, self-contained banner in the coach dashboard, shown only when the workspace subscription
  is `trialing` with `trial_ends_at` in the future: "Your free trial ends in N days — you'll be
  charged $99/mo on `<date>`. Manage billing." Links to `/billing`.
- Keep it isolated (own component + a scoped subscription read); no change to existing dashboard data flow.

## Tracking ("Claude keeps track")
- **Source of truth:** Stripe + the existing `/admin` overview (already computes trialing +
  trial_ends_at; `lib/admin-overview-data.ts:402-405`). No new code.
- **Ledger:** `Obsidian Vault/Projects/COACH-OS/founding-coaches.md` — per prospect: name,
  discipline/tools, DM state, signup date, trial start, trial end (start+14), expected first $99
  charge date, status (prospect → trialing → active → churned). Claude updates as the owner reports
  state changes and confirms against Stripe.
- **Owner action (Stripe dashboard, ~1 min):** enable trial-ending customer emails (Settings →
  Billing → Subscriptions and emails → "Send emails about expiring trials") so Stripe warns the
  coach ~7 days before the charge.

## Out of scope — parked follow-ups (separate specs)
Advisor's broader strategic threads, deferred so they don't delay outreach. These matter for COLD
outreach, not warm-Terrance:
- "Built by a founder who trains" credibility repositioning + ROI anchors on landing/subscribe.
- Student / dojo-join experience showcase on the marketing site.
- Lead-finder ToS/GDPR compliance framing (currently locked behind Coming-Soon → no live risk).
- Full Korva ↔ FoundOS brand / identity separation.
- Explicit competitive positioning vs Pike13 / TrueCoach / Zen Planner.

## Risks / notes
- **Strategy reversal:** this undoes the prior "paywall-first" decision — a trialing (unpaid) coach
  now reaches the dashboard. Intended, but a real change. Reversible: remove `trial_period_days` to
  return to pay-now.
- **Founding counter:** `/api/billing/founding-count` counts paid founding subs; verify whether it
  counts `trialing`. Soft/display-only — non-blocking. If trials should count, widen the status filter.
- **Idempotency:** the checkout idempotency key is `new-coach-checkout:${user.id}:${priceId}`; a
  coach who started a *non-trial* checkout within Stripe's 24h window could get the cached non-trial
  session. N/A for Terrance (hasn't signed up).
- **Verify before relying on it:** build + `tsc` green; then confirm a real founding checkout session
  reports a 14-day trial / $0 due today (terminal w/ platform key per session 39's pattern, or
  Stripe test mode) before/at the first real signup.

## Reversibility
Every change is additive and flag-like. Removing `trial_period_days` reverts to immediate $99
billing; the status-read and copy changes are independently safe.
