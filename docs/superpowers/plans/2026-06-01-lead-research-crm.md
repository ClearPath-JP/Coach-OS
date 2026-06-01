# Lead Research CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/coach/leads` results from a card grid into a CRM-style table with per-lead status/notes, a detail drawer, save-to-clients, and an on-demand AI outreach draft — no paid vendors, no new background DB writes.

**Architecture:** Leads stay in `lead_searches.results` (JSONB, untouched). One new lazy table `lead_interactions` holds per-lead status/notes/save-link, keyed by `(workspace_id, lead_key)`. The leads GET merges interactions into results. Three new endpoints (interaction upsert, save-to-client, outreach). The page UI is decomposed into `LeadsTable` + filters + bulk bar + detail drawer.

**Tech Stack:** Next.js 16 App Router (TS), Supabase (RLS via `current_workspace_id()`), `@anthropic-ai/sdk` (`claude-sonnet-4-6`), jest (`jest.config.cjs`) for unit/contract, Playwright for e2e smoke (pattern: `screenshots/*.mjs`).

**Verification reality:** This codebase has thin API-test infra and verifies mainly via `tsc`, `next build`, and Playwright e2e (demo coach `coach@example.com` / `Demo123!`). So: pure functions get real jest unit tests (TDD); endpoints + UI are verified with `npx tsc --noEmit`, `npm run build`, and a Playwright smoke. Don't invent a DB-mock harness that doesn't exist.

**Branch:** `rebuild/v2`. Commit after each task.

---

## File Structure

**Create**
- `supabase/migrations/20260601000000_lead_interactions.sql` — the new table + RLS + index
- `lib/leads-interactions.ts` — `normalizeLeadKey()` + shared types (`LeadStatus`, `LeadInteraction`)
- `lib/leads-interactions.test.ts` — unit tests for `normalizeLeadKey`
- `app/api/coach/leads/interaction/route.ts` — PATCH upsert status/notes
- `app/api/coach/leads/save-to-client/route.ts` — POST create client from lead
- `app/api/coach/leads/outreach/route.ts` — POST AI outreach draft
- `app/coach/leads/LeadsTable.tsx` — the CRM table (+ rows, sort, sticky header, mobile collapse)
- `app/coach/leads/LeadFiltersBar.tsx` — type/platform/status filters + name search
- `app/coach/leads/LeadBulkBar.tsx` — selection toolbar + CSV export
- `app/coach/leads/LeadDetailDrawer.tsx` — right-side drawer (status, notes, actions, outreach)
- `app/coach/leads/leads-csv.ts` — `leadsToCsv()` pure helper + test
- `app/coach/leads/leads-csv.test.ts`

**Modify**
- `app/api/coach/leads/route.ts` — merge `lead_interactions` into the returned results
- `app/coach/leads/CoachLeadsContent.tsx` — replace the card grid with the new components; keep the search form + (now collapsible) history sidebar and ALL existing search logic

**Reference (read, don't change)**
- `lib/lead-research.ts` (`LeadResult` type, Anthropic usage), `app/api/coach/leads/search/route.ts` (auth + service-client pattern), `lib/api-helpers.ts` (`requireCoach`), `lib/supabase/service.ts` (`createServiceClient`), `lib/rate-limit.ts` (`checkRateLimitAsync`), `supabase/migrations/20260523010000_lead_searches.sql` (RLS pattern).

---

## Task 1: Migration — `lead_interactions` table

**Files:** Create `supabase/migrations/20260601000000_lead_interactions.sql`

- [ ] **Step 1: Write the migration**
```sql
-- Per-lead CRM state for Lead Research. Lazy: a row exists only after a coach
-- sets a status, types a note, or saves a lead. Leads themselves stay in
-- lead_searches.results (JSONB). Keyed by lead_key so state follows a lead
-- across re-searches.
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','replied','converted','not_interested')),
  notes TEXT,
  saved_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, lead_key)
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_workspace
  ON public.lead_interactions(workspace_id);

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_interactions_select_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_select_workspace" ON public.lead_interactions
  FOR SELECT USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "lead_interactions_insert_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_insert_workspace" ON public.lead_interactions
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "lead_interactions_update_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_update_workspace" ON public.lead_interactions
  FOR UPDATE USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "lead_interactions_delete_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_delete_workspace" ON public.lead_interactions
  FOR DELETE USING (workspace_id = current_workspace_id());
```

- [ ] **Step 2: Apply it** — CHECKPOINT (needs owner). Apply via the Supabase dashboard SQL editor (MCP is read-only per project memory), OR `npm run db:push` if the DB password works. Confirm with `select count(*) from lead_interactions;` returning `0`.

- [ ] **Step 3: Regenerate types** (if the repo commits generated types) — otherwise skip. Confirm `lead_interactions` is referenced nowhere stale.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260601000000_lead_interactions.sql
git commit -m "feat(leads): lead_interactions table + RLS"
```

---

## Task 2: `lead_key` util + shared types (TDD)

**Files:** Create `lib/leads-interactions.ts`, `lib/leads-interactions.test.ts`

- [ ] **Step 1: Write the failing test** (`lib/leads-interactions.test.ts`)
```ts
import { normalizeLeadKey } from './leads-interactions'

describe('normalizeLeadKey', () => {
  it('keys by platform + lowercased handle without @', () => {
    expect(normalizeLeadKey({ platform: 'instagram', handle: '@MariaMoves', url: 'x' }))
      .toBe('instagram:mariamoves')
  })
  it('falls back to normalized url when no handle', () => {
    expect(normalizeLeadKey({ platform: 'website', handle: null, url: 'https://Foo.com/Bar/' }))
      .toBe('website:foo.com/bar')
  })
})
```

- [ ] **Step 2: Run it, expect FAIL** — `npx jest lib/leads-interactions.test.ts` → fails (module/function missing).

- [ ] **Step 3: Implement** (`lib/leads-interactions.ts`)
```ts
import type { LeadResult } from './lead-research'

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'converted' | 'not_interested'
export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'converted', 'not_interested']

export type LeadInteraction = {
  lead_key: string
  status: LeadStatus
  notes: string | null
  saved_client_id: string | null
}

/** Stable id for a lead so status/notes persist across re-searches. */
export function normalizeLeadKey(lead: Pick<LeadResult, 'platform' | 'handle' | 'url'>): string {
  const handle = (lead.handle ?? '').trim().replace(/^@/, '').toLowerCase()
  if (handle) return `${lead.platform}:${handle}`
  const url = (lead.url ?? '')
    .trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  return `${lead.platform}:${url}`
}
```

- [ ] **Step 4: Run it, expect PASS** — `npx jest lib/leads-interactions.test.ts`.

- [ ] **Step 5: Commit** — `git add lib/leads-interactions.ts lib/leads-interactions.test.ts && git commit -m "feat(leads): lead_key util + status types"`

---

## Task 3: PATCH `/api/coach/leads/interaction` (upsert status/notes)

**Files:** Create `app/api/coach/leads/interaction/route.ts`. Mirror auth/service pattern from `app/api/coach/leads/search/route.ts`.

- [ ] **Step 1: Implement the route**
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { LEAD_STATUSES } from '@/lib/leads-interactions'

const schema = z.object({
  leadKey: z.string().trim().min(1).max(300),
  status: z.enum(LEAD_STATUSES as [string, ...string[]]).optional(),
  notes: z.string().max(4000).nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`leads-interaction:${user.id}`, { windowMs: 60_000, max: 120 })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    const { leadKey, status, notes } = parsed.data
    if (status === undefined && notes === undefined) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const service = createServiceClient()
    const row: Record<string, unknown> = { workspace_id: workspaceId, coach_id: user.id, lead_key: leadKey, updated_at: new Date().toISOString() }
    if (status !== undefined) row.status = status
    if (notes !== undefined) row.notes = notes

    const { data, error } = await service
      .from('lead_interactions')
      .upsert(row, { onConflict: 'workspace_id,lead_key' })
      .select('lead_key, status, notes, saved_client_id')
      .single()
    if (error) { console.error('PATCH /api/coach/leads/interaction', error); return NextResponse.json({ error: 'Could not save' }, { status: 500 }) }
    return NextResponse.json({ data })
  } catch (err) {
    console.error('PATCH /api/coach/leads/interaction', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify types** — `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Smoke** — with the dev/prod server running and demo coach logged in, `PATCH` with `{ leadKey:'instagram:test', status:'contacted' }` returns `200` and the row appears (`select * from lead_interactions`). Re-PATCH with `{ leadKey:'instagram:test', notes:'hi' }` updates the same row (no duplicate).
- [ ] **Step 4: Commit** — `git commit -am "feat(leads): PATCH interaction upsert endpoint"`

---

## Task 4: Merge interactions into GET `/api/coach/leads`

**Files:** Modify `app/api/coach/leads/route.ts`

- [ ] **Step 1: After loading searches, fetch this workspace's interactions and merge by `lead_key`.** Add before the final `return`:
```ts
import { normalizeLeadKey, type LeadStatus } from '@/lib/leads-interactions'
// ...after `data` (searches) is loaded, before the return:
const { data: interactions } = await supabase
  .from('lead_interactions')
  .select('lead_key, status, notes, saved_client_id')
  .eq('workspace_id', workspaceId)
const byKey = new Map((interactions ?? []).map((i) => [i.lead_key, i]))

const searches = (data ?? []).map((s) => ({
  ...s,
  results: Array.isArray(s.results)
    ? s.results.map((r: Record<string, unknown>) => {
        const key = normalizeLeadKey(r as { platform: 'instagram'; handle: string | null; url: string })
        const it = byKey.get(key)
        return { ...r, leadKey: key, status: (it?.status ?? 'new') as LeadStatus, notes: it?.notes ?? null, savedClientId: it?.saved_client_id ?? null }
      })
    : s.results,
}))
return NextResponse.json({ data: { searches, limit } })
```
(Replace the existing `return NextResponse.json({ data: { searches: data ?? [], limit } })`.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit`; GET returns each lead with `leadKey/status/notes/savedClientId`.
- [ ] **Step 3: Commit** — `git commit -am "feat(leads): merge interactions into leads GET"`

---

## Task 5: POST `/api/coach/leads/save-to-client`

**Files:** Create `app/api/coach/leads/save-to-client/route.ts`. **CONFIRM FIRST:** read the existing client-create route (`app/api/clients/route.ts` or `app/api/invite-client/route.ts`) for the exact `clients` columns (recon shows `coach_id, full_name, email, phone, notes`) and reuse them verbatim.

- [ ] **Step 1: Implement** — validate `{ leadKey, name, email?, handle?, platform?, url?, reason? }`; if the interaction already has `saved_client_id`, return it (idempotent); else insert a `clients` row `{ coach_id: user.id, full_name: name, email: email ?? null, notes: 'Source: Lead Research — ' + (handle||url||'') + (reason? ' — '+reason:'') }`, then upsert `lead_interactions` setting `saved_client_id`. Return `{ data: { clientId } }`. (Mirror auth + rate-limit from Task 3.)
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; calling it creates one `clients` row and sets `saved_client_id`; calling again returns the same id (no duplicate).
- [ ] **Step 3: Commit** — `git commit -am "feat(leads): save-to-client endpoint"`

---

## Task 6: POST `/api/coach/leads/outreach` (AI draft)

**Files:** Create `app/api/coach/leads/outreach/route.ts`. Reuse the Anthropic pattern from `lib/lead-research.ts`.

- [ ] **Step 1: Implement**
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const schema = z.object({
  name: z.string().trim().max(120),
  handle: z.string().trim().max(120).nullable().optional(),
  platform: z.string().trim().max(40).optional(),
  reason: z.string().trim().max(400).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  discipline: z.string().trim().max(80).optional(),
  gymName: z.string().trim().max(120).optional(),
  area: z.string().trim().max(80).optional(),
})

const SYSTEM = `You write short, warm, NON-salesy Instagram DMs for a local fitness/martial-arts coach reaching out to a potential client or partner. 2-4 sentences, friendly, specific to the person, one soft call to action (offer a free intro/form-check). No emojis spam (one max). No hashtags. Output ONLY the message text.`

export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user } = auth
    const { success, retryAfter } = await checkRateLimitAsync(`leads-outreach:${user.id}`, { windowMs: 60_000, max: 20 })
    if (!success) { const r = NextResponse.json({ error: 'Too many requests — wait a minute' }, { status: 429 }); if (retryAfter) r.headers.set('Retry-After', String(retryAfter)); return r }
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI is not configured' }, { status: 503 })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const p = parsed.data
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 300, system: SYSTEM,
      messages: [{ role: 'user', content:
        `Coach: ${p.discipline ?? 'fitness'} coach${p.gymName ? ' at ' + p.gymName : ''}${p.area ? ' in ' + p.area : ''}.\n` +
        `Lead: ${p.name}${p.handle ? ' (' + p.handle + ')' : ''} on ${p.platform ?? 'instagram'}.\n` +
        `Why they're a fit: ${p.reason ?? 'local, interested in training'}.\n` +
        (p.bio ? `Their bio: ${p.bio}\n` : '') + `Write the DM.` }],
    })
    let text = ''; for (const b of resp.content) if (b.type === 'text') text += b.text
    return NextResponse.json({ data: { text: text.trim() } })
  } catch (err) {
    console.error('POST /api/coach/leads/outreach', err)
    return NextResponse.json({ error: 'Could not generate a message' }, { status: 502 })
  }
}
```
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; POST returns `{ data: { text } }`; 21st call in a minute → 429.
- [ ] **Step 3: Commit** — `git commit -am "feat(leads): AI outreach draft endpoint"`

---

## Task 7: CSV helper (TDD)

**Files:** Create `app/coach/leads/leads-csv.ts` + `leads-csv.test.ts`

- [ ] **Step 1: Failing test** — `leadsToCsv([{name:'A, Inc', handle:'@a', platform:'instagram', email:null, status:'new', reason:'hi'}])` returns a header row + a row with the comma-containing name quoted (`"A, Inc"`), `email` empty, `status` `new`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `leadsToCsv(rows)` — columns: Name, Handle, Type, Platform, Email, Status, Why, URL; RFC-4180 quoting (wrap fields containing `, " \n`, double internal quotes); join with `\r\n`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(leads): CSV export helper"`

---

## Task 8: `LeadsTable` component

**Files:** Create `app/coach/leads/LeadsTable.tsx`. Match the warm-dark + brass theme already used in `CoachLeadsContent.tsx` (reuse its platform-icon + type-badge helpers — extract them if shared).

- [ ] **Step 1: Build** a controlled table: props `{ leads: MergedLead[]; selected: Set<string>; onToggle(key); onToggleAll(); onRowClick(lead); sort; onSort(col) }`. Columns per spec §3.1 (checkbox, Lead name+handle, Type pill, Platform icon, Email or "—" + gated "Find email" tooltip, Socials icons, Why truncated, Status dropdown slot, Actions ↗/save/⋯). Sticky `thead`. Below ~640px (`max-[640px]:`) render each row as a stacked card (CSS, no JS). Status cell renders the `StatusDropdown` (Task 11) — define `MergedLead` type here (LeadResult + `leadKey/status/notes/savedClientId`) and export it.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git commit -am "feat(leads): LeadsTable component"`

---

## Task 9: `LeadFiltersBar` + `LeadBulkBar`

**Files:** Create `app/coach/leads/LeadFiltersBar.tsx`, `app/coach/leads/LeadBulkBar.tsx`

- [ ] **Step 1: `LeadFiltersBar`** — controlled props for `{ type, platform, status, search }` + onChange; "Export all" button calling `leadsToCsv` → download via Blob. Filtering itself happens in `CoachLeadsContent` (Task 13) — this is presentational.
- [ ] **Step 2: `LeadBulkBar`** — shown when `selected.size > 0`; buttons: Export CSV (selected), Mark as Contacted (PATCH each selected leadKey), Add to clients (POST save-to-client each), Delete selected (client-side hide + note: these are search results, "delete" removes from view only unless tied to a search). Wire callbacks from parent.
- [ ] **Step 3: Verify** `npx tsc --noEmit`. **Commit** — `git commit -am "feat(leads): filters + bulk action bars"`

---

## Task 10: `StatusDropdown`

**Files:** add to `app/coach/leads/LeadsTable.tsx` or a small `StatusDropdown.tsx`

- [ ] **Step 1:** Brass-themed select over `LEAD_STATUSES` with per-status color (new=blue, contacted=amber, replied=green, converted=brass, not_interested=muted). Props `{ value, onChange(status) }`. Optimistic — parent persists via PATCH.
- [ ] **Step 2:** `npx tsc --noEmit`. **Commit.**

---

## Task 11: `LeadDetailDrawer`

**Files:** Create `app/coach/leads/LeadDetailDrawer.tsx`. Match the approved mockup (`.superpowers/brainstorm/.../leads-drawer.html`).

- [ ] **Step 1: Build** a right slide-in (fixed, `translate-x` transition, backdrop, ESC + click-out close). Sections: avatar(initials)/name/@handle/platform; social icon links + email; `StatusDropdown` (calls PATCH); actions Copy handle (clipboard), Save to clients (POST save-to-client; show "Saved ✓" when `savedClientId` set), Send outreach; full Why; Notes `<textarea>` autosaving on blur (PATCH notes); AI outreach box — "Generate"/"Regenerate" calls POST outreach (loading state), "Copy" to clipboard. Props `{ lead, coachContext:{discipline,gymName,area}, onClose, onStatusChange, onNotesChange, onSaved }`.
- [ ] **Step 2:** `npx tsc --noEmit`. **Commit** — `git commit -am "feat(leads): lead detail drawer"`

---

## Task 12: Wire it together in `CoachLeadsContent.tsx`

**Files:** Modify `app/coach/leads/CoachLeadsContent.tsx`

- [ ] **Step 1:** Replace the results card grid (the `LeadCard` sections) with `<LeadFiltersBar/>`, `<LeadBulkBar/>`, `<LeadsTable/>`, and a `<LeadDetailDrawer/>` for the open row. Keep the search form and history sidebar; make the history sidebar collapsible (toggle button + state). Hold state: `selected:Set`, `filters`, `sort`, `openLead`. Apply filters/search/sort client-side over the active search's merged `results`. Pass `coachContext` (discipline/area from the search form; gymName from existing profile data already on the page if present, else omit).
- [ ] **Step 2:** Add a **skeleton** (animated rows) while a search is `pending`; an **empty** state showing the searched platform+query; an **error** state with retry. (Reuse existing empty-state copy where present.)
- [ ] **Step 3:** Persistence wiring — status change → optimistic update + `PATCH /interaction`; notes blur → `PATCH /interaction`; save → `POST /save-to-client`; outreach → `POST /outreach`. On failure: toast + revert.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` then `npm run build` → both clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(leads): CRM table + drawer replace card grid"`

---

## Task 13: e2e smoke (Playwright)

**Files:** Create `screenshots/leads-crm-smoke.mjs` (pattern: existing `screenshots/*.mjs`; bypass the Katana overlay via sessionStorage `sensei-opening-played='1'` + reducedMotion; login `coach@example.com`/`Demo123!`).

- [ ] **Step 1:** Script: log in → go to `/coach/leads` → open the most recent search (or run one if configured) → assert the table renders rows → click a row → assert the drawer opens → change a status → reload → assert the status persisted. Screenshot `screenshots/leads-crm.png`.
- [ ] **Step 2: Run** `node screenshots/leads-crm-smoke.mjs` against the local server; **look at the screenshot**.
- [ ] **Step 3: Commit** — `git commit -am "test(leads): CRM e2e smoke"`

---

## Self-Review (done)
- **Spec coverage:** table (T8) ✓, filters/search (T9/T12) ✓, bulk+CSV (T7/T9) ✓, status+notes persistence (T1–T4,T10,T12) ✓, drawer (T11) ✓, save-to-client (T5) ✓, AI outreach (T6) ✓, skeleton/empty/error (T12) ✓, collapsible history (T12) ✓, email gated/no-vendor (T8) ✓.
- **Type consistency:** `normalizeLeadKey`, `LeadStatus`/`LEAD_STATUSES`, `MergedLead`, and the `{leadKey,status,notes,savedClientId}` merge shape are defined once (T2/T4/T8) and reused.
- **Confirm-points flagged:** exact `clients` columns (T5), migration apply path (T1), whether gym name is on the page (T12).
