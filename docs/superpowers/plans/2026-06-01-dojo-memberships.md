# Dojo Memberships — Implementation Plan (Plan B of Classes/Memberships)

> Execute with superpowers:subagent-driven-development. Spec: `docs/superpowers/specs/2026-06-01-classes-and-dojo-memberships-design.md` (Part 2). Depends on Classes (Plan A) being in place. **Review the Stripe + webhook + booking-integration slices carefully — this handles money.**

**Goal:** Coaches sell clients recurring monthly "dojo membership" plans (Stripe) that grant class access (unlimited / X-per-month / specific types). Drop-in stays for non-members.

**Stripe architecture (decided from recon — mirror class-booking):** Use a **platform** Checkout Session in `mode: 'subscription'` with `subscription_data.transfer_data.destination = workspace.stripe_connect_account_id` (0% platform fee → no application_fee). Product + recurring Price are created on the **platform** account. Subscription/invoice **webhooks land on the existing `/api/webhooks/stripe`** (platform) — no Connect-webhook setup needed. Routed by `metadata.type='client_membership'` + lookup by `stripe_subscription_id`.

**Tech/patterns:** `lib/stripe.ts` (`stripe`), `workspaces.stripe_connect_account_id`, `requireCoach`/`requireClient` (`lib/api-helpers`), `createServiceClient`, existing webhook idempotency (`stripe_webhook_events`). RLS via `current_workspace_id()`. Branch `rebuild/v2`. Verify each task with `npx tsc --noEmit` (build only when no dev server is running on `.next`).

---

## Task 1 — Migration (DONE: file written)
`supabase/migrations/20260601020000_dojo_memberships.sql` — `membership_plans` + `client_memberships` (+RLS). **CHECKPOINT:** owner applies via dashboard.

## Task 2 — Coach membership-plan CRUD + Stripe Product/Price
**Create** `app/api/coach/memberships/route.ts` (GET list + POST create) + `app/api/coach/memberships/[id]/route.ts` (PATCH/DELETE). `requireCoach`, `createServiceClient`, rate-limit.
- **POST create:** validate `{ name, priceCents, currency?, accessType:'unlimited'|'limited'|'specific', classesPerPeriod?, appliesTo:'all'|'types', appliesToTypes?[] }`. Create a Stripe **Product** + recurring monthly **Price** on the platform (`stripe.products.create`, `stripe.prices.create({ unit_amount, currency, recurring:{ interval:'month' }, product })`) — only if `stripe` configured + status≠draft (draft plans can skip Stripe until activated). Insert `membership_plans` with `stripe_product_id`/`stripe_price_id`.
- **GET:** list plans for the workspace + a `memberCount` per plan (count `client_memberships` where status in active/trialing/past_due) + MRR sum.
- **PATCH:** edit fields; if price changed, create a NEW Stripe Price (Stripe prices are immutable) + archive the old; update the row. **DELETE:** set `status='archived'` (don't hard-delete; existing subs reference it) + archive the Stripe price.
- Verify `npx tsc --noEmit`. Commit.

## Task 3 — Client subscribe + webhook lifecycle
- **Create** `app/api/client/membership-checkout/route.ts` (POST `{ planId }`): `requireClient`; load the plan + `workspaces.stripe_connect_account_id` (503 if coach not connected); create a platform Checkout `mode:'subscription'`, `line_items:[{ price: plan.stripe_price_id, quantity:1 }]`, `subscription_data:{ transfer_data:{ destination: connectId }, metadata:{ type:'client_membership', client_id, workspace_id, plan_id } }`, `customer_email: client.email`, `metadata:{ type:'client_membership', client_id, workspace_id, plan_id }`, success→`/client/portal?membership=active`, cancel→`/client/portal?membership=cancelled`. Return `{ url }`.
- **Create** `app/api/client/membership-cancel/route.ts` (POST): `requireClient`; find their active `client_memberships`; `stripe.subscriptions.update(subId,{ cancel_at_period_end:true })`; reflect locally. (Keeps access until period end.)
- **Modify** `app/api/webhooks/stripe/route.ts` — add, routed by `metadata.type==='client_membership'` (on the session/subscription) or by looking up `client_memberships` via `stripe_subscription_id`:
  - `checkout.session.completed` (type client_membership): upsert `client_memberships` (status from the subscription, `stripe_subscription_id`, `current_period_*`, `classes_used_this_period=0`).
  - `invoice.paid` / `invoice.payment_succeeded`: reset `classes_used_this_period=0` + update `current_period_*`.
  - `customer.subscription.updated`: update `status` (active/past_due/canceled-at-period-end) + period. `customer.subscription.deleted`: `status='canceled'`, `canceled_at=now()`.
  - `invoice.payment_failed`: `status='past_due'`. (Guard so these don't collide with the existing workspace-subscription handling — distinguish membership subs by `client_memberships` lookup.)
- Verify `npx tsc --noEmit`. Commit.

## Task 4 — Booking integration (book-class)
**Modify** `app/api/client/book-class/route.ts`. After the capacity/duplicate check and before the Connect-account check, load the client's live `client_memberships` (status active/trialing) + its `membership_plans`. Decide by the class slot's `member_access` (the slot row already has it):
- `drop_in_only` → ignore membership; charge drop-in (existing flow).
- `included` → covered if: plan active AND (access_type='unlimited' OR (access_type='limited' AND classes_used_this_period < classes_per_period)) AND (applies_to='all' OR the class type ∈ applies_to_types). If covered → create the `sessions` booking directly (`paid_at=now()`, status confirmed, NO stripe_checkout_id) + increment `classes_used_this_period`; return booked. Else → drop-in charge.
- `members_only` → covered → book free (as above); NOT covered → 403 "Members only — subscribe to book this class."
- Verify `npx tsc --noEmit`. Commit.

## Task 5 — Coach Memberships page (UI)
New route `app/coach/memberships/page.tsx` + `MembershipsContent.tsx` (matches the approved mockup): MRR strip (sum of active plans' price × members) + plans list + create/edit plan form (name · price/mo · Access segmented · classes/period · applies-to · Active/Draft) + members list (name, plan, "X/Y used", status). Add a **Memberships** nav entry in the coach sidebar (`app/coach/CoachSidebarShell.tsx`). Verify tsc (+ build when server stopped). Commit.

## Task 6 — Client subscribe UI (client portal)
A "Dojo membership" section in the client portal: shows the coach's `active` plans; **Subscribe** → POST membership-checkout → redirect to Stripe `url`; if already a member, show plan + "X classes left this month" + **Manage/Cancel**. Verify tsc. Commit.

## Task 7 — e2e smoke (Stripe test mode, after migration applied)
Verify: coach creates a plan (Stripe price created); client subscribes (test card) → webhook activates membership; booking an `included` class is free + decrements; `members_only` blocks non-members. Document any manual Stripe-test steps.

## Self-review
Covers spec Part 2: plans CRUD + Stripe price (T2), client subscribe + lifecycle webhooks (T3), booking coverage/decrement/members-only (T4), coach UI + MRR (T5), client subscribe/manage (T6). Platform-subscription-with-destination keeps webhooks on the existing endpoint. Drop-in unaffected for non-members.
