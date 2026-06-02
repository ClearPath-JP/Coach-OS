# Classes Overhaul + Dojo Memberships (Design)

- **Date:** 2026-06-01
- **Status:** Approved in brainstorm (mockups validated) — pending implementation plans
- **Project:** 2 of 3 (Leads ✓ → **Classes/Memberships** → Promote)
- **Surfaces:** `/coach/classes`, coach schedule, client portal (booking + membership)

## Goal

Two connected features, both mockup-validated with the owner:

1. **Classes Overhaul** — replace the minimal 3-field "add a slot" form with a rich create/edit form, a weekly schedule view, and a bookings/attendance panel. **Reuses** the existing class-booking + Stripe Connect pipeline.
2. **Dojo Memberships** — coaches sell clients **recurring monthly plans** (Stripe Connect subscriptions) that grant class access (unlimited / X-per-month / specific), for recurring income. Per-class drop-in stays for non-members.

**Build order:** Classes first (foundation), then Memberships (depends on classes). **Two implementation plans**, built + reviewed in slices (like Leads).

## Design principle — reuse the working pipeline

Today a "class" = a `recurring_availability` slot + a `session_packages` row (price/capacity/duration) + `sessions` rows (paid bookings via Stripe Connect destination charges, 0% platform fee). We **extend** this, not rebuild it.

---

# PART 1 — Classes Overhaul

## 1.1 Data model (extend existing)
One coach-facing "class" is backed by a `recurring_availability` row (the slot) + a 1:1 `session_packages` row (price/capacity/duration/description/type), created and edited together via ONE form. New columns on `recurring_availability`:
- `name` TEXT, `location` TEXT, `color` TEXT, `status` TEXT (`active`|`draft`, default `active`)
- `one_time_date` DATE (NULL = weekly recurring; set = one-time class; `day_of_week` becomes nullable when one-time)
- `member_access` TEXT (`included`|`members_only`|`drop_in_only`, default `drop_in_only`) — connects to Part 2; **stored but inert until Memberships ships**
- `class_group_id` UUID — groups the multiple rows created for a multi-day class (one row per selected weekday) so "edit/delete all" can act on the group

New table `class_occurrence_overrides` (for "this occurrence vs all future"): `class_group_id`/`slot_id`, `occurrence_date` DATE, `canceled` BOOL, plus nullable override fields (start_time, capacity, location…). The on-demand occurrence generator (`/api/client/available-classes`) consults these to skip/modify single dates.

`session_packages` already carries price_cents/currency/capacity/duration_minutes/description/session_type/is_virtual — reused for the class.

## 1.2 Create / edit form (validated mockup)
Fields: **name** · **type/category** (tag; pick-or-type custom) · **color** · **description** (optional, client-facing) · **location** · **capacity** · **price** (drop-in) · **Repeat weekly** toggle (on → day(s)-of-week multi-select; off → single `one_time_date` picker) · **start time** · **end time OR duration** · **member access** (included / members-only / drop-in only) · **Active/Draft**. Inline validation. Edit opens the same form pre-filled.

## 1.3 Weekly schedule view (validated mockup)
Grouped by day. Class cards: color stripe · name · type tag · **↻ weekly** / **one-time · date** badge · time · location · booked-avatar stack + "X / Y booked" · price/member label · **Bookings / Edit / Delete**. Empty state when no classes. Classes also continue to appear on the existing coach Schedule.

## 1.4 Bookings / attendance panel (validated mockup)
Slide-out for a specific class occurrence: roster (avatar, name, **MEMBER** tag, booked date), **attendance checkboxes** (persisted), **"Message all booked"** (reuse the existing broadcast/messaging). Attendance storage: a column on the booking `sessions` row (`attended` BOOL, `attendance_marked_at`) OR a small `class_attendance` table — decide in the plan (lean: column on sessions).

## 1.5 Edit / delete recurring ("this vs all")
Editing/deleting a recurring class prompts **"This occurrence"** vs **"All future."** "This" → write a `class_occurrence_overrides` row (canceled or modified). "All future" → update/soft-delete the slot(s) in the `class_group_id`.

## 1.6 Client booking (mostly unchanged)
Existing `book-class` + `available-classes` keep working; they begin to respect `member_access` once Part 2 lands (until then, everything behaves as `drop_in_only`).

---

# PART 2 — Dojo Memberships

## 2.1 Data model (new tables)
`membership_plans`: `workspace_id`, `coach_id`, `name`, `price_cents`, `currency`, `interval` (`month`), `access_type` (`unlimited`|`limited`|`specific`), `classes_per_period` INT (if limited), `applies_to` (`all`|`types`), `applies_to_types` TEXT[] (if types), `stripe_product_id`, `stripe_price_id`, `status` (`active`|`draft`), timestamps.

`client_memberships`: `workspace_id`, `client_id`, `plan_id`, `stripe_subscription_id`, `status` (`active`|`past_due`|`canceled`|`trialing`), `current_period_start`, `current_period_end`, `classes_used_this_period` INT default 0, timestamps, `canceled_at`.

Both workspace-scoped with RLS (`current_workspace_id()` pattern, like every other table).

## 2.2 Stripe Connect recurring (NEW plumbing — the meaty part)
- Creating a plan → create a **Product + recurring Price on the coach's connected account** (mirror the existing Connect + 0%-fee model from class booking; exact direct-vs-destination decided in the plan).
- Client subscribes → **Stripe Checkout in `subscription` mode** → on success a `client_memberships` row (via webhook).
- Extend `/api/webhooks/stripe` for subscription lifecycle: `customer.subscription.created/updated/deleted`, `invoice.paid` (reset `classes_used_this_period` at each new period), `invoice.payment_failed` (→ `past_due`).
- Cancel/manage: client can cancel (Stripe billing portal or a cancel route).

## 2.3 Coach UI — Memberships page (validated mockup)
**MRR strip** (recurring $/mo + active member count) · **Plans** list + **create/edit plan** form (name · price/mo · Access: Unlimited / X-per-month / Specific · Applies to: all / choose types · Active/Draft) · **Members** list (name, plan, usage e.g. "5/8 used", status).

## 2.4 Client UI — subscribe
Client portal "Dojo membership" section: the coach's active plans → **Subscribe** (Stripe Checkout) → manage/cancel + see remaining classes this period.

## 2.5 Booking integration (the tie-in)
At `book-class`, load the client's active membership. Decide by the class's `member_access`:
- **`drop_in_only`** → always charge the drop-in price (existing flow), even for members.
- **`included`** → if the membership covers it (unlimited, OR limited with `classes_used_this_period < classes_per_period`, AND `applies_to` matches the class type) → **book free + increment** `classes_used_this_period`; otherwise → drop-in charge.
- **`members_only`** → bookable only if covered; otherwise blocked ("Members only").

The client class card/button shows the right price/label for that client's state (Free · Members only · $drop-in).

## 2.6 v1 scope
Benefit = **class access only**. Perks/discounts/merch later. "Specific classes" plans via `applies_to: types`.

---

## How the two connect
`class.member_access` + `plan.access_type`/`applies_to` + `client_memberships` drive the booking decision. **Classes ships first** with `member_access` stored but inert (treated as drop-in); Memberships then activates the logic.

## Out of scope (v1)
Non-class perks, proration UI, annual/family plans, pausing memberships, refunds UI.

## To resolve during planning (read real code)
- Exact Stripe Connect **subscription** setup — read `app/api/billing/*` (stripe-connect), `app/api/client/book-class`, `app/api/webhooks/stripe`, `lib/stripe*`; reuse the connected-account + 0%-fee model.
- Attendance: column on `sessions` vs new table (lean: column).
- Multi-day class = N `recurring_availability` rows sharing a `class_group_id` + 1 package — confirm the booking/occurrence generator handles the group.
- **Migrations** (several new columns + 3 new tables) need the owner to apply (Supabase MCP is read-only).
- **Plan-gating:** is Dojo Memberships a higher-tier Kindo feature? (see `project_pricing_model`.)

## Build sequencing
- **Plan A — Classes Overhaul:** migrations (new columns + `class_occurrence_overrides`), the create/edit form, schedule view, bookings/attendance panel, edit/delete "this vs all", `member_access` field (inert). Ships independently.
- **Plan B — Dojo Memberships:** `membership_plans` + `client_memberships` tables, Stripe Connect recurring + webhooks, coach Memberships page (plans + members + MRR), client subscribe/manage, and the booking integration. Depends on A.
