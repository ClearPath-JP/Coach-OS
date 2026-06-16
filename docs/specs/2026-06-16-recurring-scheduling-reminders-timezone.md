# Recurring Scheduling, Bulk Assignments, Workspace Timezone & Automated Reminders — Design

**Date:** 2026-06-16
**Branch:** design/dojo-arcade (proposed work; not started)
**Status:** SPEC ONLY — migrations are PROPOSED and must be owner-approved before applying. No app code written. No migration run.

---

## 1. Context

Korva (COACH-OS) is multi-tenant Next.js App Router + Supabase (Postgres), live on `korvacoach.com`
/ `coach.foundos.ai`. Prod project = `owiqourfyjxwveopijrg` (FREE/Nano — heavy work must run on a
separate/local DB per the no-heavy-dev-on-prod rule).

This spec covers four interlocking audit gaps that all touch scheduling/time and all require schema
changes:

1. **Recurring sessions** (1-on-1) — today a coach books each session one at a time
   (`POST /api/sessions`, `app/coach/schedule/BookSessionModal.tsx`). There is no "every Tuesday 5pm
   for 8 weeks" recurrence for *private sessions*.
2. **Recurring classes (RRULE-style)** — classes already recur weekly via `recurring_availability`
   (one row per weekday) + per-occurrence overrides (`class_occurrence_overrides`), but the recurrence
   model is implicit ("weekly forever, by `day_of_week`") with no end date, no interval (bi-weekly),
   and no canonical RRULE. We formalize it without breaking the existing weekly model.
3. **Recurring / bulk assignments** — `POST /api/assignments/assign` assigns one template to one
   client once. Coaches want "assign this to the whole roster" and "re-assign every week"
   (e.g. a weekly check-in worksheet).
4. **Workspace timezone model + automated 24h/1h reminders** — `workspaces.timezone` and
   `profiles.timezone` already exist (default `America/New_York`), and `app/api/availability/materialize`
   already has a correct Intl-based `fromZonedTime`. But usage is **inconsistent**: `POST
   /api/client/book-class` computes instance times with naive local server time
   (`new Date(\`${instanceDate}T00:00:00\`)` + `setHours`), which is wrong on Vercel (UTC servers).
   Reminders today are **manual only** (`POST /api/sessions/[id]/send-reminder` fires an n8n webhook
   when the coach clicks). There is no automated 24h-before / 1h-before reminder.

### What already exists (verified in-repo — reuse, don't rebuild)

| Concern | Where | Notes |
|---|---|---|
| Workspace TZ column | `supabase/migrations/20240316000010_settings.sql` | `workspaces.timezone TEXT NOT NULL DEFAULT 'America/New_York'` |
| Coach TZ column | `profiles.timezone` | read in `app/api/availability/materialize/route.ts` |
| TZ setting UI/API | `app/api/settings/workspace/route.ts` (handles `updates.timezone`), `lib/validations.ts` `updateWorkspaceSettingsSchema` | already wired |
| Correct zoned→UTC conversion | `app/api/availability/materialize/route.ts` `fromZonedTime()` | Intl-based, no extra dep — **promote to a shared lib** |
| Recurring class slots | `recurring_availability` (+ `classes_overhaul`, `class_slots_pay_to_secure`) | weekly by `day_of_week`, `one_time_date`, `class_group_id`, `is_client_bookable` |
| Per-occurrence overrides | `class_occurrence_overrides` (`20260601010000`) | `(recurring_availability_id, occurrence_date)` unique, `canceled`, time/capacity/location override |
| Booking → session | `sessions` (`recurring_availability_id`, `stripe_checkout_id`, `paid_at`, dedup unique index) | webhook inserts the row |
| One-off session create | `POST /api/sessions` (`coachCalendarSessionCreateSchema`) | accepts `scheduledIso` (browser TZ) OR `date`+`startTime` |
| Manual reminder | `POST /api/sessions/[id]/send-reminder` → n8n `N8N_SESSION_REMINDER_ON_DEMAND_URL` | rate-limited 30/min |
| Cron auth + executor pattern | `app/api/studio/dispatch-due/route.ts`, `app/api/cron/reconcile-renders/route.ts` | `CRON_SECRET` Bearer; n8n every 10 min (`MuFLALR3xNiUhhXI`); Vercel cron daily (`vercel.json`) |
| Email send pattern | `app/api/studio/dispatch-due/route.ts` (Resend REST, `EMAIL_FROM_DEFAULT`) | header-injection-safe subject |
| Assignment assign | `POST /api/assignments/assign` (`assignToClientSchema`) | creates `client_assignments` + posts an `assignment` chat card |
| Workspace RLS helper | `current_workspace_id()` (`20240315000004` + `20240328000021`) | SECURITY DEFINER, used everywhere |

### Hard constraints (project rules)

- **Never modify Supabase schema or RLS without owner approval.** This doc is the approval artifact.
- TypeScript only; no new packages without asking (this spec needs **zero** new deps — TZ math via
  `Intl`, recurrence expanded in app code, RRULE stored as text we generate/parse ourselves).
- Keep changes focused + reversible; solo founder.
- Vercel Hobby = **one cron/day max** in `vercel.json`. So the *frequent* reminder sweep runs on the
  existing **n8n** scheduler (every 10–15 min), hitting a `CRON_SECRET`-protected route — exactly the
  `dispatch-due` pattern already in prod.

---

## 2. Goals / Non-goals

**Goals**
- A coach can create a **recurring private session series** ("weekly, Tue 17:00, ends in 8 weeks /
  on a date / never") that materializes individual `sessions` rows, editable as "this one" vs "all
  future".
- Classes get a **canonical, explicit recurrence** (RRULE-style: `FREQ`, `INTERVAL`, `BYDAY`,
  `UNTIL`/`COUNT`) layered onto the existing `recurring_availability` model without breaking current
  weekly-forever classes or the booking/override logic.
- A coach can **bulk-assign** one template to many clients in one action, and optionally make it
  **recurring** (re-assign on a cadence) — generating the same per-client `client_assignments` rows +
  chat cards the single path makes today.
- One **canonical timezone** per workspace drives all instant computation; every place that turns a
  wall-clock (date + time) into an instant uses the **same shared helper**. Fix the `book-class`
  naive-time bug.
- **Automated reminders**: each upcoming session/class booking gets a **24h-before** and **1h-before**
  reminder, sent once each (deduped), via the existing n8n + Resend path. Manual "send now" stays.

**Non-goals (YAGNI for v1)**
- Full iCal RRULE engine (RSCALE, BYSETPOS, EXDATE lists). We support the small subset coaches use:
  weekly / bi-weekly / specific weekdays / end-by-date-or-count. Cancellations of single occurrences
  reuse the existing `class_occurrence_overrides.canceled` mechanism (our "EXDATE").
- Per-client individual timezones for *display math* beyond what the browser already renders (clients
  see times in their own browser TZ via existing `components/client/PortalLocalDate.tsx`). The
  workspace TZ is the **authoring/source-of-truth** TZ.
- SMS/push reminders (email only for v1; the n8n webhook payload is channel-agnostic so SMS can be
  added later without schema change).
- Rescheduling a paid class occurrence with automatic refunds (separate money flow).
- Reminders for assignments due-dates (could reuse the same sweep later; out of scope now).

---

## 3. Timezone model (foundation — do this FIRST)

### 3.1 Principle
**Store instants in UTC (`timestamptz`, already the case). Author in the workspace timezone. Convert
at the boundary with one shared helper.** Clients view in their browser TZ (unchanged).

### 3.2 Schema (PROPOSED)
`workspaces.timezone` already exists and is the source of truth. The only additions are guardrails +
making coach TZ explicit:

```sql
-- PROPOSED migration: 20260616000000_timezone_hardening.sql
-- Additive only. Safe to run before any code change.

-- 1. Ensure profiles.timezone exists (materialize route already reads it; settings has workspaces.timezone).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN public.profiles.timezone IS
  'Coach/user IANA tz (e.g. America/New_York). Falls back to workspaces.timezone then UTC. Authoring tz, not display.';

-- 2. Backfill any null/blank workspace tz to the existing default (defensive; column default already set).
UPDATE public.workspaces SET timezone = 'America/New_York'
  WHERE timezone IS NULL OR btrim(timezone) = '';

-- 3. (Optional, recommended) validate tz strings against a known set at the app layer (zod enum of a
--    curated IANA list) rather than a CHECK constraint, so we don't need a DB function to validate.
--    No DB change for this item.
```

> No RLS change: `workspaces`/`profiles` policies are unchanged (owner/self scoped). Reads of
> `timezone` happen server-side via the service role or the existing workspace-scoped selects.

### 3.3 Shared helper (code, not schema)
Promote the proven converter out of the route into `lib/time/zoned.ts`:

```ts
// lib/time/zoned.ts  (NEW — extracted verbatim from app/api/availability/materialize/route.ts)
export function fromZonedTime(dateTimeStr: string, timeZone: string): Date { /* …existing Intl impl… */ }
export function toZonedParts(instant: Date, timeZone: string): { y:number; mo:number; d:number; h:number; min:number } { /* inverse, via Intl.DateTimeFormat */ }
export function resolveWorkspaceTz(workspaceTz?: string | null, coachTz?: string | null): string {
  return (coachTz?.trim() || workspaceTz?.trim() || 'UTC')
}
```

- `app/api/availability/materialize/route.ts` → import from the lib (delete its local copy).
- **Bug fix** `app/api/client/book-class/route.ts` §2: replace naive
  `new Date(\`${instanceDate}T00:00:00\`)` + `setHours()` with
  `fromZonedTime(\`${instanceDate}T${slot.start_time}\`, resolveWorkspaceTz(workspace.timezone, coachTz))`.
  Load `workspaces.timezone` (already partly loaded in step 5 of that route) in the slot query.
- `POST /api/sessions` already prefers browser `scheduledIso`; keep that, but when only `date`+`startTime`
  is sent (no browser TZ), convert via the workspace TZ instead of server-local `new Date('…T…')`.

**Acceptance:** booking the same class from a browser in PST and a server in UTC yields the *same*
`scheduled_time` instant; that instant matches "5:00 PM in the workspace's timezone".

---

## 4. Recurring private sessions (1-on-1)

### 4.1 Model decision
Private sessions are NOT backed by `recurring_availability` (that table is the class/availability
template and is already overloaded with class fields). Add a dedicated, small **series** table and
**materialize** concrete `sessions` rows from it — mirroring how `availability/materialize` already
expands `recurring_availability` into `availability_slots`. Materialized rows are normal `sessions`
(so the calendar, reminders, attendance, notes all work with zero downstream changes).

### 4.2 Schema (PROPOSED)

```sql
-- PROPOSED migration: 20260616000100_session_series.sql
CREATE TABLE IF NOT EXISTS public.session_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  session_product_id UUID REFERENCES public.session_packages(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL DEFAULT 'in_person',           -- mirror sessions.session_type
  -- Recurrence (RRULE subset; we generate/parse this string ourselves, no library):
  rrule TEXT NOT NULL,                                       -- canonical, e.g. 'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU'
  dtstart_date DATE NOT NULL,                                -- first occurrence date (wall date in workspace tz)
  start_time TIME NOT NULL,                                  -- wall-clock start in workspace tz
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  until_date DATE,                                           -- inclusive end (null if count-based or open)
  count INTEGER CHECK (count IS NULL OR count > 0),          -- max occurrences (null if until/open)
  timezone TEXT NOT NULL,                                    -- snapshot of authoring tz (so later tz changes don't shift a live series)
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','canceled')),
  materialized_through DATE,                                 -- how far we've created sessions rows
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_series_end_oneof CHECK (NOT (until_date IS NOT NULL AND count IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_session_series_workspace ON public.session_series(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_series_coach ON public.session_series(coach_id);
CREATE INDEX IF NOT EXISTS idx_session_series_active
  ON public.session_series(workspace_id, status) WHERE status = 'active';

ALTER TABLE public.session_series ENABLE ROW LEVEL SECURITY;

-- RLS: workspace-scoped + must be a coach in the workspace (mirror recurring_availability /
-- assignment_templates_coach_*). Clients do NOT write series; they read via the materialized sessions.
DROP POLICY IF EXISTS "session_series_coach_all" ON public.session_series;
CREATE POLICY "session_series_coach_all" ON public.session_series
  FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.workspace_id = session_series.workspace_id)
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.workspace_id = session_series.workspace_id)
  );

-- Link materialized sessions back to their series (additive on sessions).
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_series_id UUID REFERENCES public.session_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_occurrence_date DATE;       -- the wall date this instance represents

CREATE INDEX IF NOT EXISTS idx_sessions_series
  ON public.sessions(session_series_id) WHERE session_series_id IS NOT NULL;

-- One session per series per occurrence date (dedup re-materialization races; mirrors the
-- pay-to-secure unique index style).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sessions_series_occurrence
  ON public.sessions(session_series_id, series_occurrence_date)
  WHERE session_series_id IS NOT NULL AND series_occurrence_date IS NOT NULL;

NOTIFY pgrst, 'reload schema';
```

### 4.3 Materialization
- A shared expander `lib/recurrence/expand.ts` (NEW) turns `(rrule, dtstart_date, until/count)` into a
  bounded list of dates (cap horizon at **e.g. 12 weeks ahead**, like the materialize route's 6-week
  cap — choose 12). For each date, `fromZonedTime(date + start_time, series.timezone)` → `scheduled_time`,
  `+duration_minutes` → `end_time`. Insert `sessions` (status `confirmed`, `session_series_id`,
  `series_occurrence_date`) with upsert-on-conflict (the unique index) so re-runs are idempotent.
- **When to materialize:**
  1. On series create/update (synchronous, first window).
  2. On the reminder sweep (§7) — the same authenticated cron route extends `materialized_through`
     forward so long-running series keep producing rows (rolling 12-week window). No separate cron.
- **Edit semantics** ("this one" vs "all future"):
  - *This one*: edit the single `sessions` row (already supported by `PATCH /api/sessions/[id]` — verify
    it exists; `app/api/sessions/[id]/route.ts` is present).
  - *All future*: set `session_series.until_date = day before the edit date` on the old series, create a
    NEW series from the edit date with the new params (classic "split the series" pattern — avoids
    rewriting already-materialized/paid past rows). Delete future un-started `sessions` rows of the old
    series (`scheduled_time > now()`).
  - *Cancel one*: delete/cancel the single `sessions` row; record nothing else (gap is fine).

### 4.4 RRULE string format (the subset we own)
- `FREQ=WEEKLY` (only freq for v1), `INTERVAL=1|2` (weekly / bi-weekly), `BYDAY` = comma list of
  `MO,TU,WE,TH,FR,SA,SU`. Termination is via `until_date` OR `count` columns (not inside the string),
  to keep parsing trivial and queryable. We generate the string for storage/auditing; the expander
  reads the structured columns + `BYDAY`. This keeps "RRULE-style" without an RFC-5545 dependency.

### 4.5 API + UI touch-points
- NEW `POST /api/sessions/series` (create), `PATCH/DELETE /api/sessions/series/[id]` — `requireCoach`,
  rate-limited like `sessions-post`, zod `sessionSeriesCreateSchema` in `lib/validations.ts`.
- UI: extend `app/coach/schedule/BookSessionModal.tsx` with a "Repeat" control (Off / Weekly /
  Every 2 weeks, weekday multi-select prefilled from the picked date, and "Ends: never / on date /
  after N times"). Calendar (`app/coach/schedule/*`) shows materialized rows already (they're `sessions`).

---

## 5. Recurring classes (RRULE-style, layered on the existing model)

### 5.1 Decision: extend `recurring_availability`, don't replace it
Classes already recur. Today the implicit rule is "weekly, on `day_of_week`, forever, unless
`one_time_date` is set." We make recurrence **explicit and bounded** without breaking that:

### 5.2 Schema (PROPOSED)

```sql
-- PROPOSED migration: 20260616000200_class_recurrence.sql  (ADDITIVE)
ALTER TABLE public.recurring_availability
  ADD COLUMN IF NOT EXISTS freq TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (freq IN ('WEEKLY')),
  ADD COLUMN IF NOT EXISTS interval_weeks SMALLINT NOT NULL DEFAULT 1 CHECK (interval_weeks BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS series_start_date DATE,       -- anchor for INTERVAL math (null ⇒ legacy "every week")
  ADD COLUMN IF NOT EXISTS series_until_date DATE;        -- inclusive end (null ⇒ open-ended, current behavior)

COMMENT ON COLUMN public.recurring_availability.interval_weeks IS
  '1=weekly (legacy default), 2=bi-weekly, etc. Anchored on series_start_date.';
COMMENT ON COLUMN public.recurring_availability.series_until_date IS
  'Last date this weekly class runs (inclusive). NULL keeps the existing open-ended behavior.';

-- Index to find live classes quickly without scanning ended ones.
CREATE INDEX IF NOT EXISTS idx_recurring_availability_live
  ON public.recurring_availability(workspace_id, day_of_week)
  WHERE status = 'active';

NOTIFY pgrst, 'reload schema';
```

- **Backward compatible:** existing rows get `interval_weeks=1`, null start/until ⇒ identical to today
  ("every `day_of_week`, forever"). `one_time_date` (single class) and `class_group_id` (multi-day
  class) are untouched. `class_occurrence_overrides.canceled` remains the EXDATE mechanism.
- A multi-weekday class stays **multiple rows sharing `class_group_id`** (the established pattern), each
  carrying its own `day_of_week` + the same `interval_weeks`/`series_*`. We do NOT pack `BYDAY` into one
  row — that would break booking/override which key off `day_of_week`.

### 5.3 Occurrence expansion (the one place to change)
There is one place that turns a class slot into bookable instances for the client UI
(`app/api/client/available-classes/route.ts` — confirmed present) and the coach calendar. Update its
date expansion to honor the new fields:
- Only emit a date `D` if: `D >= COALESCE(series_start_date, today)`, `D <= COALESCE(series_until_date, horizon)`,
  and (legacy) `weekday(D)==day_of_week`, and **interval check**:
  `floor(weeks_between(series_start_date, D)) % interval_weeks == 0` (skip when `series_start_date` null).
- Apply `class_occurrence_overrides` (cancel/time/capacity) exactly as today.
- Compute the instant with `fromZonedTime(D + start_time, workspaceTz)` (same shared helper — also fixes
  the booking-time bug end-to-end).

### 5.4 UI
- `app/coach/classes/*` class editor: add Repeat (Weekly / Every N weeks), Start date, and "Ends
  (never / on date)". No change to the bookings panel.

---

## 6. Recurring / bulk assignments

### 6.1 Decision
Two capabilities, smallest footprint:
1. **Bulk assign now** — server-side loop over the existing single-assign logic for a list of
   `clientId`s (and/or a "whole active roster" flag). No new table; reuses `client_assignments` +
   the `assignment` chat card from `app/api/assignments/assign/route.ts`.
2. **Recurring assignment** — a small schedule table that a cron sweep expands into the same
   single-assign action on a cadence.

### 6.2 Schema (PROPOSED)

```sql
-- PROPOSED migration: 20260616000300_assignment_schedules.sql
CREATE TABLE IF NOT EXISTS public.assignment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_template_id UUID NOT NULL REFERENCES public.assignment_templates(id) ON DELETE CASCADE,
  -- Targeting: explicit client list, or 'all_active' resolved at run time.
  target_kind TEXT NOT NULL DEFAULT 'clients' CHECK (target_kind IN ('clients','all_active')),
  client_ids UUID[],                                          -- used when target_kind='clients'
  -- Cadence (reuse the same RRULE subset shape as session_series for consistency):
  rrule TEXT NOT NULL,                                        -- e.g. 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'
  start_date DATE NOT NULL,
  until_date DATE,
  count INTEGER CHECK (count IS NULL OR count > 0),
  due_days_after_assign INTEGER,                              -- overrides template default when set
  timezone TEXT NOT NULL,                                     -- authoring tz snapshot (cadence is date-based)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  last_run_date DATE,                                         -- dedup: never assign twice for one cadence date
  runs_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assignment_schedules_end_oneof CHECK (NOT (until_date IS NOT NULL AND count IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_assignment_schedules_workspace ON public.assignment_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assignment_schedules_active
  ON public.assignment_schedules(status) WHERE status = 'active';

ALTER TABLE public.assignment_schedules ENABLE ROW LEVEL SECURITY;

-- RLS: coach-in-workspace (mirror assignment_templates_coach_*).
DROP POLICY IF EXISTS "assignment_schedules_coach_all" ON public.assignment_schedules;
CREATE POLICY "assignment_schedules_coach_all" ON public.assignment_schedules
  FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_schedules.workspace_id)
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_schedules.workspace_id)
  );

-- Optional provenance: tag which schedule created a given assignment (helps de-dupe + reporting).
ALTER TABLE public.client_assignments
  ADD COLUMN IF NOT EXISTS assignment_schedule_id UUID REFERENCES public.assignment_schedules(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
```

### 6.3 Logic
- Extract the per-client body of `POST /api/assignments/assign` into a reusable
  `lib/assignments/assign-one.ts` (`assignTemplateToClient({ service, workspaceId, coachUserId, templateId, clientId, dueAt })`)
  that: checks the per-client plan cap (`checkAssignmentsPerClientLimit`), inserts `client_assignments`,
  bumps `client_rewards.assignments_total`, posts the `assignment` chat card. The current route becomes a
  thin wrapper.
- **Bulk now:** NEW `POST /api/assignments/assign-bulk` (`requireCoach`, rate-limited) accepts
  `{ templateId, clientIds[] | allActive: true, dueAt? }`, resolves the roster, loops `assignTemplateToClient`,
  returns `{ assigned, skipped: [{clientId, reason}] }` (skips clients over cap / without portal accounts —
  don't fail the whole batch).
- **Recurring:** the reminder sweep (§7) also processes due `assignment_schedules`: for each active row
  where the next cadence date `<= today (in its tz)` and `> last_run_date`, resolve targets and call
  `assignTemplateToClient` for each, then set `last_run_date`, bump `runs_completed`, and `ended` when
  `count`/`until_date` is reached. `last_run_date` is the dedup guard (idempotent if the sweep runs twice).

### 6.4 UI
- `app/coach/assignments/*`: add "Assign to multiple" (client multi-select + "select all active") and a
  "Repeat" toggle (Weekly / Every N weeks, ends never/date/count) on the assign action.

---

## 7. Automated reminders (24h + 1h, deduped) — reuse send-reminder + cron

### 7.1 Decision
Keep the **manual** `POST /api/sessions/[id]/send-reminder` exactly as-is (coach "remind now"). Add an
**automated sweep** that finds upcoming `sessions` needing a 24h and/or 1h reminder, fires the *same*
n8n webhook, and records the send so it never double-fires. This is the `dispatch-due` pattern applied
to sessions.

### 7.2 Schema (PROPOSED) — dedup ledger
Two reminder offsets per session, each sent at most once. A tiny ledger table is cleaner than boolean
columns (extensible to SMS/other offsets, easy unique constraint):

```sql
-- PROPOSED migration: 20260616000400_session_reminders.sql
CREATE TABLE IF NOT EXISTS public.session_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  offset_kind TEXT NOT NULL CHECK (offset_kind IN ('24h','1h')),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),  -- room for 'sms' later
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT,
  -- Dedup: one (session, offset, channel) reminder ever.
  UNIQUE (session_id, offset_kind, channel)
);

CREATE INDEX IF NOT EXISTS idx_session_reminders_workspace ON public.session_reminders(workspace_id);

ALTER TABLE public.session_reminders ENABLE ROW LEVEL SECURITY;
-- Reads are workspace-scoped (coach can audit). Writes happen via the service role in the cron route
-- (RLS bypass), so only a SELECT policy is needed — mirrors how webhook/cron tables are handled.
DROP POLICY IF EXISTS "session_reminders_select_workspace" ON public.session_reminders;
CREATE POLICY "session_reminders_select_workspace" ON public.session_reminders
  FOR SELECT USING (workspace_id = public.current_workspace_id());

NOTIFY pgrst, 'reload schema';
```

> The UNIQUE constraint is the real dedup guarantee even if the sweep runs concurrently or twice:
> the second insert hits `23505` and we skip — same defensive pattern as the booking dedup index.

### 7.3 The sweep route (code)
NEW `app/api/cron/session-reminders/route.ts` — copy the auth + structure of `dispatch-due`:
- `authorized()` via `CRON_SECRET` Bearer (identical helper).
- `runtime='nodejs'`, `dynamic='force-dynamic'`, `GET` and `POST` both call the handler.
- Window logic (UTC instants, so TZ-safe by construction):
  - **24h**: sessions with `scheduled_time` in `[now+23h, now+25h]`, `status in ('confirmed','pending')`,
    not already having a `('24h','email')` ledger row.
  - **1h**: sessions with `scheduled_time` in `[now+30m, now+90m]`, same filters, no `('1h','email')` row.
  - (A ±1h / ±30m tolerance covers a 10–15 min sweep cadence without misses or dupes.)
- For each due session, **insert the ledger row first** (`INSERT … ON CONFLICT DO NOTHING`); if it
  inserted 0 rows, another pass already claimed it → skip (claim-before-send avoids double email under
  concurrency). Then POST the existing n8n payload shape to `N8N_SESSION_REMINDER_ON_DEMAND_URL`
  (or a new `N8N_SESSION_REMINDER_SCHEDULED_URL`), including `offset_kind` so the email copy can say
  "tomorrow" vs "in 1 hour". On webhook failure, update the ledger row to `status='failed', error=…` so
  it can be retried/reported (or delete it to allow a clean retry next pass — choose **mark failed +
  allow retry** by treating `failed` rows as re-claimable for N attempts).
- Also (per §4.3 / §6.3) this same route **extends materialization** for `session_series` and processes
  due `assignment_schedules`, so we add **one** scheduler, not three.

### 7.4 Scheduling the sweep
- **Primary:** an **n8n** schedule node every **10–15 min** → HTTP Request to
  `/api/cron/session-reminders` with `Authorization: Bearer $CRON_SECRET` (the exact mechanism behind the
  live `MuFLALR3xNiUhhXI` Studio workflow). This sidesteps the Vercel-Hobby one-cron/day limit.
- **Belt-and-suspenders:** optionally add a daily Vercel cron entry in `vercel.json` as a backstop
  (catches a missed 24h reminder if n8n is down) — same file already has the `reconcile-renders` daily
  cron, so this is a one-line addition (no Hobby conflict since it's still ≤1/day there if we keep the
  frequent one on n8n).

### 7.5 Payload (unchanged contract + one field)
```jsonc
{ "session_id": "...", "scheduled_time": "...ISO...", "client": { "first_name", "last_name", "email" },
  "type": "reminder", "offset_kind": "24h" }     // offset_kind is the only addition
```
n8n template (Resend) renders the email; the coach's existing email config (`EMAIL_FROM_DEFAULT`,
`RESEND_API_KEY`) is reused. If the webhook URL is unset, the route no-ops cleanly (like
`dispatch-due` does when `RESEND_API_KEY` is missing) — never errors the cron.

---

## 8. Code touch-points (summary)

**New files**
- `lib/time/zoned.ts` — shared `fromZonedTime` / `resolveWorkspaceTz` (extracted, no new dep).
- `lib/recurrence/expand.ts` — RRULE-subset → date list (sessions + classes + assignment cadences).
- `lib/assignments/assign-one.ts` — extracted single-assign body.
- `app/api/sessions/series/route.ts`, `app/api/sessions/series/[id]/route.ts` — series CRUD.
- `app/api/assignments/assign-bulk/route.ts` — bulk assign.
- `app/api/cron/session-reminders/route.ts` — the unified sweep (reminders + materialize + assignment cadences).

**Edited files**
- `app/api/availability/materialize/route.ts` — use shared `fromZonedTime`.
- `app/api/client/book-class/route.ts` — TZ bug fix (load `workspaces.timezone`, use `fromZonedTime`); honor `interval_weeks`/`series_*` via the shared expander.
- `app/api/client/available-classes/route.ts` — honor `interval_weeks`/`series_*` + shared TZ helper.
- `app/api/sessions/route.ts` — TZ-correct fallback when no `scheduledIso`.
- `app/api/assignments/assign/route.ts` — become a thin wrapper over `assign-one.ts`.
- `lib/validations.ts` — `sessionSeriesCreateSchema`, `assignBulkSchema`, `assignmentScheduleSchema`.
- `app/coach/schedule/BookSessionModal.tsx` — Repeat control.
- `app/coach/classes/*` — Repeat/Start/Ends fields.
- `app/coach/assignments/*` — multi-select + Repeat.
- `vercel.json` — (optional) daily backstop cron entry.

**Migrations (PROPOSED, in order)**
1. `20260616000000_timezone_hardening.sql`
2. `20260616000100_session_series.sql`
3. `20260616000200_class_recurrence.sql`
4. `20260616000300_assignment_schedules.sql`
5. `20260616000400_session_reminders.sql`

**Env (no secrets in repo; owner sets in Vercel)**
- Reuse `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM_DEFAULT`, `N8N_SESSION_REMINDER_ON_DEMAND_URL`.
- Optional new `N8N_SESSION_REMINDER_SCHEDULED_URL` (a distinct n8n workflow for automated copy).

---

## 9. Phased rollout

**Phase 0 — Timezone foundation (lowest risk, high value)**
Migration 1 + extract `lib/time/zoned.ts` + fix `book-class`/`available-classes`/`sessions` to use it.
Ship alone; verify "5pm in workspace tz" books correctly from multiple browser TZs. No UI change.

**Phase 1 — Automated reminders**
Migration 5 + `app/api/cron/session-reminders` (reminders only, skip materialize/assignments branches) +
n8n schedule. This is independently shippable on top of Phase 0 and delivers the headline value
(no-shows drop) without any recurrence work. Verify dedup with the ledger.

**Phase 2 — Recurring private sessions**
Migration 2 + series CRUD + `expand.ts` + materialize branch in the sweep + `BookSessionModal` Repeat.

**Phase 3 — Recurring classes**
Migration 3 + expansion updates in `available-classes` + coach class editor fields.

**Phase 4 — Bulk + recurring assignments**
Migration 4 + `assign-one.ts` refactor + `assign-bulk` route + assignment-cadence branch in the sweep +
assignments UI. (Bulk-now can ship before recurring-assignments if desired.)

Each phase: build + `tsc` + `next build` green; apply migration to a **non-prod** DB first; owner
applies to prod after review (per project rules).

---

## 10. Risks & mitigations

- **Timezone correctness (DST):** the Intl-based `fromZonedTime` already handles DST offsets correctly
  (it re-reads the offset for the specific instant). Snapshotting `timezone` on each series means a
  later workspace-TZ change won't silently shift an in-flight series. *Risk:* a coach who *moves*
  timezones expects existing series to follow — document that changing workspace TZ only affects *new*
  series/classes; offer "regenerate future occurrences" if needed (out of scope v1).
- **Materialization runaway:** open-ended series capped at a rolling 12-week horizon; the sweep only
  extends, never back-fills past. Unique index `(session_series_id, series_occurrence_date)` makes
  re-materialization idempotent.
- **Double reminders / double assigns:** guaranteed-once via UNIQUE `(session_id, offset_kind, channel)`
  and `assignment_schedules.last_run_date`; claim-before-send ordering in the sweep. Vercel-cron backstop
  cannot double-send because it shares the same ledger.
- **Cron auth:** route is `CRON_SECRET`-Bearer gated and no-ops if env is unset (matches
  `dispatch-due`/`reconcile-renders`); never throws to avoid cron alert noise.
- **Free/Nano DB load:** the sweep queries are indexed (`scheduled_time`, `status` partial indexes) and
  capped (`limit 50` per pass like the existing crons); 10–15 min cadence is light. Do not run heavy
  back-materialization against prod.
- **Backward compatibility:** all schema is additive (`ADD COLUMN IF NOT EXISTS`, new tables); existing
  classes default to today's behavior (`interval_weeks=1`, null start/until). No RLS weakened — every new
  table is workspace-scoped + coach-gated exactly like its siblings; writes that must bypass RLS go
  through the service role in cron routes (the established pattern).
- **Class multi-weekday modeling:** we keep the existing "one row per weekday sharing `class_group_id`"
  shape rather than `BYDAY`-in-one-row, so booking/override (`day_of_week`-keyed) is untouched. The
  trade-off (editing a multi-day class touches N rows) already exists today.

---

## 11. Open questions for owner
1. Reminder offsets: confirm **24h + 1h**. Add a 15-min "starting soon"? (easy — new `offset_kind` enum
   value, no structural change).
2. Materialization horizon: **12 weeks** ok for private series?
3. Bulk-assign "all active": should it include clients without portal accounts (skipped today) or hard-
   error? (spec assumes **skip + report**).
4. Do we want the optional Vercel daily backstop cron, or n8n-only for the sweep?
