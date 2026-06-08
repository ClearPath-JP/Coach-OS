# Passes (Class-Credit Packs) + Client Video Library — Design

**Date:** 2026-06-08
**Branch:** rebuild/v2
**Status:** Approved by owner ("lets do it, lock in", 2026-06-08)

## 1. Context

COACH-OS (Korva) is multi-tenant and live on prod. Verified 2026-06-08 against the prod DB
(`owiqourfyjxwveopijrg`, ACTIVE_HEALTHY): workspaces + RLS, Stripe Connect (coach→bank),
one-time + recurring client payments, classes/booking, dojo memberships, Bunny video, and
webhook idempotency are **all real on prod**.

Launch decision: put the first founding coach live now on what already works, then ship two
follow-up features that complete the client flow:

1. **Passes** — prepaid class-credit packs ("10 classes for $120"). Client buys via Stripe
   (funds → coach's connected account), balance is tracked, booking a class spends one credit,
   client re-buys when low.
2. **Client video library** — a simple "Videos" tab where clients watch the videos their coach
   chooses to share (today videos only appear inside assigned programs).

Passes replaces the misnamed "Packages" feature, which today is only a price template attached
to a one-off invoice and grants no balance.

## 2. Goals / Non-goals

**Goals**
- Coach defines credit packs; client buys + re-buys via Stripe to the coach's bank.
- Pass balance tracked durably; booking decrements it atomically; expiry optional.
- Client can browse + watch coach-shared videos.

**Non-goals (YAGNI for v1)**
- Time-based / unlimited passes (chosen model is credit packs only).
- Pass refunds/transfers/gifting UI.
- Auto-share-all video; folders/playlists beyond existing categories.
- Platform application fee on pass purchases (stay 0%, consistent with current flows).
- Reconciling Bunny encoded size vs upload size (tracked separately as cleanup).

## 3. Passes — data model

Two NEW tables, kept separate from `session_packages` (which already doubles as the hidden
"class type" definition behind classes — overloading it further is fragile).

### `class_passes` (coach's pass products)
- `id uuid pk`, `workspace_id uuid not null`, `coach_id uuid not null`
- `title text not null`, `description text`
- `price_cents int not null check (price_cents >= 0)`, `currency text not null default 'usd'`
- `credit_count int not null check (credit_count > 0)` — classes granted
- `applies_to text not null default 'all' check (applies_to in ('all','types'))`
- `applies_to_types text[]` — used when `applies_to='types'`; **mirror the exact semantics
  `membership_plans.applies_to_types` uses** so the booking coverage match reuses the same logic
- `expires_in_days int check (expires_in_days is null or expires_in_days > 0)` — null = never
- `is_active boolean not null default true`
- `created_at`, `updated_at`
- RLS: workspace-scoped CRUD (mirror `membership_plans` in `20260601020000_dojo_memberships.sql`)

### `client_passes` (purchased balances)
- `id uuid pk`, `workspace_id uuid not null`, `client_id uuid not null`,
  `pass_id uuid not null references class_passes(id)`
- `credits_total int not null`, `credits_remaining int not null check (credits_remaining >= 0)`
- `status text not null default 'active' check (status in ('active','depleted','expired','refunded'))`
- `stripe_checkout_id text unique` — idempotency for webhook fulfillment
- `purchased_at timestamptz not null default now()`, `expires_at timestamptz` — null = never
- `created_at`, `updated_at`
- Indexes: `(workspace_id, client_id, status)`, `(client_id, expires_at)` for FIFO selection
- RLS: client sees own (`client_id` → their `clients` row), coach sees workspace
  (mirror `client_memberships` policies)

Each purchase = one `client_passes` row (additive). Total balance = sum of `credits_remaining`
across active, non-expired rows.

## 4. Passes — flows

### Buy — `POST /api/client/buy-pass`
- Body `{ passId }`. Auth via `requireClient()`.
- Validate: pass `is_active`, belongs to client's workspace; coach has
  `stripe_connect_account_id` and `charges_enabled` (reuse guard from `lib/client-invoice-checkout-post.ts`).
- Stripe Checkout `mode:'payment'`, line item from `price_cents`/`currency`,
  `payment_intent_data.transfer_data.destination = connectId` (no application fee),
  idempotency key per client+pass+timestamp.
- `metadata = { type:'pass_purchase', pass_id, client_id, workspace_id, credit_count, expires_in_days }`.
- Success/cancel URLs back to the client passes page (`NEXT_PUBLIC_APP_URL`).
- Pattern: near-copy of `book-class/route.ts:293-328`.

### Fulfill — webhook `checkout.session.completed`, `case 'pass_purchase'`
- New `lib/stripe-pass-purchase-webhook.ts` `createPassFromCheckout()`.
- Idempotent on `stripe_checkout_id` (insert-or-ignore).
- Insert `client_passes`: `credits_total = credits_remaining = credit_count`;
  `expires_at = now() + expires_in_days` (or null).
- **Additive — never resets.** Do NOT reuse the membership `invoice.paid` reset path.
- Service-role write with `workspace_id` from validated metadata.

### Spend — booking in `app/api/client/book-class/route.ts`
- Insert a coverage tier between membership and Stripe drop-in (the `:117-266` block).
- Order: **membership coverage → pass credit → pay drop-in via Stripe**.
- Pass selection: client's `client_passes` where `status='active'`, `credits_remaining>0`,
  `(expires_at is null or expires_at > now())`, and the pass covers this class type
  (`applies_to='all'` OR class type ∈ `applies_to_types` — reuse membership coverage match).
  FIFO: `order by expires_at nulls last, purchased_at asc`.
- Atomic decrement (reuse optimistic-lock at `:195-251`):
  `UPDATE client_passes SET credits_remaining = credits_remaining - 1,
   status = CASE WHEN credits_remaining - 1 = 0 THEN 'depleted' ELSE status END
   WHERE id = $1 AND credits_remaining > 0 RETURNING id`.
  If 0 rows, try next pass; else fall through to Stripe.
- On success insert a free `sessions` row tagged pass-covered (mirror membership-covered insert).
  Roll back the decrement if the session insert fails (mirror `:237-251`).

## 5. Passes — coach UI
- Re-label the **"Packages" nav tab → "Passes"**, pointing to new management
  (`app/coach/passes/*` + `app/api/coach/passes`). Define/edit/archive packs: title, price,
  credit_count, applies-to, optional expiry, active.
- Simple roster: which clients hold passes and credits remaining (client detail and/or a list).
- **Do not break** existing classes (depend on `session_packages`) or one-off invoices. Verify a
  coach can still create a custom one-off invoice after the relabel; keep that entry point.

## 6. Passes — client UI
- New **"Passes"** area: active balances ("7 of 10 classes left", expiry if set),
  buy / buy-more via Stripe, purchase history; low-balance nudge.
- Booking screen shows "Uses 1 class credit (N left)" when a covering pass exists, else "Pay $X".
  Reuse Checkout-redirect + success/cancel banner plumbing from `ClientClassesContent.tsx` /
  `MembershipContent.tsx`.

## 7. Client video library
- Add `videos.shared_with_clients boolean not null default false`.
- Coach `VideosPageContent.tsx`: per-video "Share with clients" toggle →
  `PATCH /api/videos/[id] { shared_with_clients }`.
- New client route `app/client/(main)/videos` + `GET /api/client/videos`: list workspace videos
  where `shared_with_clients=true`, `processing_status='ready'`, `deleted_at is null`, grouped by
  existing `category`. Reuse `VideoPlayer` (Bunny iframe).
- Extend `clientCanAccessVideo()` (`lib/video-stream-access.ts`) to also allow
  `shared_with_clients=true` videos for clients in that workspace (in addition to program/
  assignment access). Token route returns the embed URL unchanged.
- Add "Videos" to client nav.

## 8. Security & RLS
- New tables: workspace-scoped RLS mirroring the membership tables (`client_passes`:
  client-sees-own + coach-sees-workspace; `class_passes`: workspace-scoped).
- Money-path writes (buy webhook, booking decrement) run via service role with `workspace_id`
  from validated Stripe metadata / the authenticated client — never from client-supplied body.
- Video sharing relies on the existing access-function + token-route gate (clients never select
  the `videos` table directly), so the new column needs no client-facing RLS change.

## 9. Migration & rollout
- New migrations: `20260608000000_class_passes.sql` (both pass tables + RLS + indexes),
  `20260608000001_videos_shared_with_clients.sql`.
- **Prod migration-log drift (important):** prod schema is current, but
  `supabase_migrations.schema_migrations` only records entries through 2024-03 (earlier 2026
  features were applied via SQL editor, not the CLI tracker). **Do NOT run `supabase db push`**
  against prod — it may replay history that doesn't match. Apply the two new migrations directly
  via Supabase MCP `apply_migration` (records cleanly) or SQL editor, **after build is green and
  owner approves** (per the "ask before schema changes" rule).
- Keep `coach.foundos.ai` as canonical `NEXT_PUBLIC_APP_URL`; a Vercel project rename to `korva`
  is cosmetic and needs no code change.

## 10. Testing
- Stack present: Jest (`npm run test:unit`), Playwright E2E. TDD the risky logic.
- Unit/integration (tests first):
  - buy-pass route: validation + Stripe params (destination, no fee, metadata).
  - webhook `pass_purchase`: idempotency (same `stripe_checkout_id` twice = one row), additive
    stacking, expiry set.
  - booking decrement: FIFO selection, coverage match, atomic decrement, rollback on session-
    insert failure, fall-through to Stripe when no credits.
- E2E (Playwright / Claude Chrome) with `create:demo` + `seed:test-client`: coach creates pass →
  client buys (Stripe test) → balance shows → client books → credit decrements → client watches a
  shared video.

## 11. Phased implementation plan
- **Phase 0 (no schema, parallel):** Bunny delete-on-delete + require upload `fileSizeBytes`.
  Branding cosmetic polish (separate, low priority).
- **Phase 1:** pass migrations + zod validations.
- **Phase 2:** buy-pass route + webhook fulfillment (+ tests).
- **Phase 3:** booking decrement integration (+ tests).
- **Phase 4:** coach Passes UI + client passes UI + booking credit display.
- **Phase 5:** client video library.
- **Phase 6:** build green → apply prod migrations (owner OK) → deploy → live E2E.

## 12. Appendix — Track 1 launch checklist
- [ ] (You) Add a card to Bunny.net before the trial ends (pay-as-you-go, pennies/mo).
- [ ] (You/me) Verify Stripe founding price = $99/mo in **live** mode
      (`npm run verify:stripe-env` checks env wiring; amount/mode is a dashboard check).
- [ ] (You/me) Verify live Stripe webhook endpoint + events (checkout/subscription/invoice).
- [ ] (You) Enable Supabase leaked-password protection (1 toggle).
- [ ] (You/me) Rename Vercel project → `korva` (keep `coach.foundos.ai`).
- [ ] (Me) Phase 0 Bunny cleanup.
- [ ] (Me) Live end-to-end test before handoff.
