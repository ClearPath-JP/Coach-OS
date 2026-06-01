# Lead Research — CRM Table, Detail Drawer & Lead Pipeline (Design)

- **Date:** 2026-06-01
- **Status:** Approved in brainstorm — pending implementation plan
- **Project:** 1 of 3 (Leads → Classes → Promote)
- **Surface:** `/coach/leads`

## 1. Goal

Refactor the Lead Research results from a 2-column card grid into a scannable, CRM-style **table** with per-lead **status** and **notes**, a right-side **detail drawer**, **save-to-clients**, and an **AI outreach draft** — without adding paid vendors or new database write load (we are on Supabase Free / Nano).

## 2. Scope

**In scope**
- Replace the card grid with a dense CRM table (filters, bulk actions, sortable, sticky header, mobile collapse).
- Per-lead status + notes persistence (lazy).
- Lead detail drawer (incl. AI outreach draft generated on demand).
- Save a lead into the existing `clients` table.
- Client-side CSV export; collapsible history; skeleton + empty + error states.

**Out of scope (deferred)**
- Live email enrichment via a paid vendor (Hunter/Apollo/RocketReach). The "Find email" affordance ships **gated "coming soon."** Emails that the existing Instagram scrape already surfaces are still shown.
- Promoting every scraped lead into its own DB row ("leads-as-rows" normalization).
- Social OAuth / DM automation.

## 3. UX (validated via visual mockups)

### 3.1 Results table — dense CRM (chosen layout "A")
Columns: **checkbox** · **Lead** (name bold + `@handle` muted) · **Type** pill (Individual / Partner / Business) · **Platform** icon · **Email** (scraped value or "—"; small gated "Find email") · **Socials** (clickable icons, one per platform present, open in new tab) · **Why** (truncated to one line; full text on row expand/drawer) · **Status** dropdown · **Actions** (open profile ↗, save to clients, more ⋯).

Behavior: default sort = best-lead-first (unchanged ranking); column sort; sticky header; **click a row → detail drawer**; table collapses to stacked rows below ~640px.

Bulk: selecting checkboxes reveals a toolbar — **Export CSV**, **Mark as Contacted**, **Add to clients**, **Delete selected**.

### 3.2 Filters / search bar (above table)
Filter by **Type**, **Platform**, **Status**; **name/handle** search box. All client-side over the loaded result set. **Export all** (CSV).

### 3.3 History sidebar
Keep, made **collapsible**. Each item: query summary, date, lead count, done/failed. Click reloads its results into the table. Per-item delete (already exists).

### 3.4 Detail drawer (right slide-in) — validated mockup
Avatar/initials · name · `@handle` · platform; row of social link icons + email; **Status** dropdown; quick actions **Copy handle / Save to clients / Send outreach**; full **Why**; **Notes** textarea (autosave on blur); **AI outreach draft** box with **Regenerate** + **Copy**.

### 3.5 States
- **Skeleton** table rows while a search runs (replaces blank screen).
- **Empty** state showing the platform + query searched, with a clear retry CTA.
- **Error** state with retry (search failures).

## 4. Architecture

### 4.1 Data model
Leads stay where they are: the `lead_searches.results` JSONB array (unchanged). The only new persistence is per-lead CRM state.

**New table `lead_interactions`** (the only schema change):

| column | type | purpose |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid → workspaces | ownership + RLS |
| `coach_id` | uuid → profiles | actor |
| `lead_key` | text | stable id = `platform:normalizedHandleOrUrl` — status follows a lead across re-searches |
| `status` | text | enum: new / contacted / replied / converted / not_interested (default `new`) |
| `notes` | text | coach free text |
| `saved_client_id` | uuid → clients (null) | set when "Save to clients" used |
| `created_at`, `updated_at` | timestamptz | |
| unique `(workspace_id, lead_key)` | | one row per lead per workspace |

**Lazy creation (critical for the IO budget):** a row is created/updated **only** when the coach sets a status, types a note, or saves a lead. Running a search writes nothing to this table. No polling writes anywhere.

`lead_key` normalization: `platform` + `:` + lowercased handle with leading `@` stripped, falling back to the normalized profile URL when no handle exists.

### 4.2 Migration SQL (apply after approval — dashboard SQL editor or `db:push`)
```sql
create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  lead_key text not null,
  status text not null default 'new'
    check (status in ('new','contacted','replied','converted','not_interested')),
  notes text,
  saved_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, lead_key)
);
create index if not exists lead_interactions_workspace_idx
  on public.lead_interactions(workspace_id);
alter table public.lead_interactions enable row level security;
-- RLS: copy the workspace-scoped select/insert/update/delete policies VERBATIM
-- from 20260523010000_lead_searches.sql (same workspace-isolation predicate).
```

### 4.3 API endpoints
- **GET `/api/coach/leads`** (existing): additionally left-joins `lead_interactions` by `lead_key` for the active workspace and merges `{ status, notes, savedClientId }` into each returned lead. Searches with no interactions return `status: 'new'` defaults.
- **PATCH `/api/coach/leads/interaction`** (new): body `{ leadKey, status?, notes? }` → upsert on `(workspace_id, lead_key)`; validates the status enum; bumps `updated_at`.
- **POST `/api/coach/leads/save-to-client`** (new): body `{ name, email, handle, platform, url, reason }` → insert a `clients` row (notes seeded with handle/url + "Source: Lead Research"); set `saved_client_id` on the interaction (lazy-create it); return `clientId`. Idempotent: if `saved_client_id` already set, return it.
- **POST `/api/coach/leads/outreach`** (new): body `{ lead }` → Anthropic SDK draft (reuses the existing integration) using the coach profile's **gym name / specialty / area** + the lead's bio/why. Rate-limited (~20/min/user). Returns `{ text }`. **Not persisted.**
- **CSV export**: built client-side from loaded rows + merged status. No endpoint.
- Existing search (POST) / history (GET) / delete (DELETE [id]) logic is **untouched**.

### 4.4 Display refactor
Refactor `app/coach/leads/CoachLeadsContent.tsx`, extracting:
- `LeadsTable` (rows, sort, sticky header, mobile collapse)
- `LeadFiltersBar` (type/platform/status + search)
- `BulkActionsBar` (selection + bulk ops + CSV)
- `LeadDetailDrawer` (the validated drawer, incl. outreach)
- `StatusDropdown`, skeleton + empty + error states

Keep the search form and (now collapsible) history sidebar. **All existing Apify/Claude search logic stays as-is** — this is a display + persistence layer change.

## 5. Data flow
search → `lead_searches.results` (unchanged) → GET merges `lead_interactions` → table renders → coach edits status/note → PATCH (lazy upsert, optimistic UI) · saves → POST save-to-client · outreach → POST outreach (on demand). CSV is built in memory.

## 6. Error handling
- PATCH / save failures → toast + revert optimistic UI.
- Outreach AI timeout/failure → inline error + retry; 429 → "slow down" message.
- Save-to-client: inserts a new client row (no dedupe in v1; `clients.email` has no unique constraint). Re-saving the same lead is a no-op (returns existing `clientId`).
- Search failure → existing handling + a retry button.

## 7. Performance / DB load (Free–Nano aware)
Writes are lazy and user-initiated only; outreach is on demand and unstored; CSV is client-side; GET adds one indexed join on `workspace_id`. No background or per-poll writes.

## 8. Testing
- Contract tests: PATCH interaction (upsert + enum validation + workspace RLS), save-to-client (creates a client + links `saved_client_id`, idempotent), outreach (returns text, enforces rate limit).
- Smoke: table renders from merged data; a status change persists across reload; drawer opens with correct lead.

## 9. Rollout
Apply the migration first (with approval), then ship the code (replaces the existing UI directly — no flag). `tsc` + `next build` clean before commit. Branch `rebuild/v2`.
