# Classes Overhaul — Implementation Plan (Plan A of Classes/Memberships)

> **For agentic workers:** execute with superpowers:subagent-driven-development — one implementer per task, spec + code-quality review between. Spec: `docs/superpowers/specs/2026-06-01-classes-and-dojo-memberships-design.md` (Part 1).

**Goal:** Replace the minimal "add a slot" form with a rich class create/edit form, a weekly schedule view, and a bookings/attendance panel — reusing the existing booking + Stripe Connect pipeline.

**Architecture:** A class = recurring_availability slot(s) + a 1:1 session_packages row, managed together via one form. Multi-day = N slots sharing `class_group_id`. Rich fields + `member_access` (inert until Memberships) + per-occurrence overrides added by migration `20260601010000_classes_overhaul.sql`.

**Tech:** Next 16 / TS / Supabase (RLS `current_workspace_id()`), existing Stripe Connect class booking. Branch `rebuild/v2`. Verify each task with `npx tsc --noEmit` (+ `npm run build` on UI tasks). Commit per task.

---

## Task 1 — Migration (DONE: file written)
`supabase/migrations/20260601010000_classes_overhaul.sql` — adds class fields to `recurring_availability`, `attended`/`attendance_marked_at` to `sessions`, and the `class_occurrence_overrides` table (+RLS). **CHECKPOINT:** owner applies via dashboard (MCP read-only). Verify: `select column_name from information_schema.columns where table_name='recurring_availability';` shows the new columns.

## Task 2 — Class CRUD API
**Create** `app/api/coach/classes/route.ts` (GET list, POST create) + `app/api/coach/classes/[id]/route.ts` (PATCH, DELETE). Read `app/api/availability/route.ts` + `app/api/packages/route.ts` for the auth/service pattern (`requireCoach` → `{user,workspaceId,supabase}`; `createServiceClient`).
- **Create:** one form payload → upsert a 1:1 `session_packages` row (title=name, description, price_cents, currency, duration_minutes, capacity, session_type=type, is_virtual) + create `recurring_availability` row(s): one per selected weekday (or one with `one_time_date`), all sharing a generated `class_group_id`, carrying name/location/color/status/member_access/start_time/end_time/session_product_id/is_client_bookable.
- **PATCH/DELETE:** accept `scope: 'occurrence' | 'all'`. `all` → update/soft-delete (`status` or `is_active`) every row in the `class_group_id` (+ its package). `occurrence` → write a `class_occurrence_overrides` row (`canceled` for delete, override fields for edit) keyed by (recurring_availability_id, occurrence_date).
- Validate with zod; rate-limit like existing coach routes. Verify: `npx tsc --noEmit`.

## Task 3 — Occurrence generation + bookings/attendance API
- **Modify** `app/api/client/available-classes/route.ts`: hide `status='draft'`; apply `class_occurrence_overrides` (skip `canceled` dates, apply field overrides); keep capacity/booking-count logic. (member_access: leave behavior as drop-in for now; Plan B adds member logic.)
- **Create** `app/api/coach/classes/[id]/bookings/route.ts` (GET roster for `?date=` → `sessions` joined to clients for that slot+date, paid only) + PATCH attendance (`{ sessionId, attended }` → set `attended`/`attendance_marked_at`).
- **Message-all:** reuse the existing broadcast endpoint (`app/api/messages/broadcast`) — pass the booked client ids. Verify: `npx tsc --noEmit`.

## Task 4 — Create/edit class form (UI)
**Modify** `app/coach/classes/CoachClassesContent.tsx` (read it first). Replace the 3-field form with the validated rich form (a modal or inline panel): name · type/category (datalist of common types + custom) · color swatch · description · location · capacity · price · **Repeat weekly** toggle (on → weekday multi-select; off → date input) · start · end-or-duration · **member access** (included/members-only/drop-in) · Active/Draft. Inline validation. Submits to the Task 2 API; Edit pre-fills. Verify: `npx tsc --noEmit` + `npm run build`.

## Task 5 — Weekly schedule view (UI)
Replace the table list with the validated card view (new `app/coach/classes/ClassScheduleView.tsx`): grouped by day; cards = color · name · type tag · ↻weekly/one-time badge · time · location · booked-avatars + "X/Y" · price/member label · Bookings/Edit/Delete. Empty state. Verify: tsc + build.

## Task 6 — Bookings/attendance panel + recurring edit/delete (UI)
- New `app/coach/classes/ClassBookingsPanel.tsx` — slide-out: roster (avatar, name, MEMBER tag, booked date), attendance checkboxes (PATCH), "Message all booked". Opened from a card's "Bookings".
- Edit/Delete on a recurring class → a small "This occurrence / All future" prompt → calls Task 2 PATCH/DELETE with the right `scope`. Wire into CoachClassesContent. Verify: tsc + build.

## Task 7 — e2e smoke (after migration applied)
`screenshots/classes-smoke.mjs` (Playwright, demo coach): create a class → see it on the schedule → open bookings → mark attendance. Screenshot. 

## Self-review
Covers spec Part 1: rich form (T4) ✓, schedule view (T5) ✓, bookings/attendance (T6) ✓, this-vs-all edits (T2,T6) ✓, one-time vs recurring (T2,T4) ✓, member_access field stored (T1,T2,T4) ✓, draft hidden from clients (T3) ✓. Membership *logic* is Plan B. Reuses booking+Stripe (unchanged).
