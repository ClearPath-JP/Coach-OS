# Promote + Library Redesign — Design Spec

**Date:** 2026-06-05
**Branch:** `rebuild/v2`
**Owner-approved:** plan shape + both gates approved 2026-06-05 (Chrome audit + brainstorm session). Schema gate = **build + apply additive migration to prod overnight**. Folders = **deferred**.
**Status:** approved → implementing overnight (autonomous mode).

---

## 1. Context

Two video-centric coach surfaces need work, driven by a live Claude-Chrome audit reconciled against the real code:

- **Promote** (`app/coach/promote/`) — a 3-path wizard (Idea / Chat / Video) that generates a social post or Reel plan. Today it is **stateless and throwaway**: generate → copy → gone. No drafts, no history, no editing, no saved brand voice.
- **Video Library** (`app/coach/videos/`) — upload/import + categorize coaching clips. Categories already work (CRUD, colors, tabs, bulk-assign). But it **does not scale**: no search/sort, single-video category edit is a silent no-op, management is hidden behind hover, filenames are titles, and the mobile header overflows.

Goal: turn Promote from a one-shot generator into a **content workspace**, and make the Library **scale, read visually, and connect to Promote** — tailored to a solo coach who films and posts often. Presentation + small additive data layer only; **no changes to existing tables/RLS**, **no new npm packages**.

### Audit reconciliation (what we trust)
- **Real:** read-only output (no inline edit); throwaway (no saved posts); no library search/sort; **category single-edit bug** (`api/videos/[id]` PATCH writes legacy `category` text, tabs filter on `category_id` → edit is a no-op); filenames-as-titles; minor polish (step-3 label, plain "OR" divider, empty chat canvas, invisible storage bar fill).
- **Real, verify at true 375 first:** library mobile **header overflow** (`PageHeader` is fixed-height with 4 action buttons).
- **False positives (do NOT blindly fix):** "Promote cards don't stack on mobile" — code is `grid sm:grid-cols-3`, already stacks <640px (Chrome's 375 sim wasn't a true viewport). "No kebab / can't manage from grid" — the ⋯ menu exists but is `opacity-0` until hover → real issue is **discoverability (esp. touch)**, not absence.
- **Inaccuracy:** "What you coach" is pre-filled from **localStorage**, not a saved profile — which is itself the opportunity (Brand Voice).

---

## 2. Goals / Non-goals

**Goals**
1. Promote becomes a workspace: **inline-editable output**, **Saved Posts** (draft → posted), **saved Brand Voice**, **platform target** before generating.
2. Library **scales**: search + sort, discoverable per-video management, mobile header that fits.
3. Library **connects**: "Use in Promote" from any card.
4. Fix the **category single-edit bug**.
5. Visual polish on both, brass-consistent.

**Non-goals (this build)**
- Folders / sub-grouping (deferred — separate spec if needed).
- Full multi-clip editor (combine/crop/timeline) — separate spec written tonight, **no code**.
- Record-in-app on mobile.
- Meta auto-publish, TikTok/LinkedIn (IG + FB only, manual post stays Tier 1).
- No new npm packages. No changes to existing tables or RLS.

---

## 3. Data layer (additive — two new tables)

Both mirror the existing workspace-scoped RLS pattern used by `video_categories` / `video_edits` (`current_workspace_id()`), and `coach_id → profiles(id)` like `videos`. Migration: `supabase/migrations/20260605000000_promote_posts_and_profile.sql`.

### 3.1 `promote_posts` (Saved Posts)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| workspace_id | uuid not null | → workspaces(id) on delete cascade |
| coach_id | uuid not null | → profiles(id) on delete cascade |
| path | text not null | `'idea' \| 'chat' \| 'video'` (how it was made) |
| kind | text | `'class'\|'workout'\|'book1on1'\|'bts'` or null |
| platform | text | `'instagram'\|'facebook'` or null (target) |
| tone | text | `'hype'\|'calm'\|'friendly'` |
| type | text not null | `'post' \| 'video'` (matches `PromoteResult.type`) |
| content | jsonb not null | the `Post` or `VideoPlan` object — single representation for render + inline edit |
| title | text | short label for the shelf (derived from hook/hookIdea) |
| source_video_id | uuid | → videos(id) on delete set null (if made from a library clip) |
| status | text not null | `'draft' \| 'posted'`, default `'draft'` |
| posted_at | timestamptz | set when marked posted |
| created_at | timestamptz not null | default now() |
| updated_at | timestamptz not null | default now() |

Indexes: `(workspace_id, created_at desc)`, `(coach_id)`. RLS: all CRUD where `workspace_id = current_workspace_id()`.

### 3.2 `promote_profile` (Brand Voice — one row per workspace)
| Column | Type | Notes |
|---|---|---|
| workspace_id | uuid pk | → workspaces(id) on delete cascade |
| discipline | text | "what you coach" (e.g. Brazilian Jiu-Jitsu) |
| tone | text | default `'friendly'` |
| platform | text | default `'instagram'` (default target) |
| booking_url | text | coach's booking/enquiry link, woven into CTAs |
| signature | text | optional sign-off / handle |
| updated_at | timestamptz not null | default now() |

RLS: all CRUD where `workspace_id = current_workspace_id()`. Written via upsert.

> Exact PK/RLS/`gen_random_uuid` convention copied from `video_categories` migration at build time.

---

## 4. API (new + one change)

**New — Saved Posts** (`requireCoach`, rate-limited, workspace-scoped):
- `GET  /api/coach/promote/posts` — list (newest first; optional `?status=`).
- `POST /api/coach/promote/posts` — create a draft from a generated result `{ path, kind?, platform?, tone, type, content, title?, sourceVideoId? }` → returns `{ id }`.
- `PATCH /api/coach/promote/posts/[id]` — update `content` (inline edits) and/or `status` (`posted` sets `posted_at`).
- `DELETE /api/coach/promote/posts/[id]` — remove.

**New — Brand Voice:**
- `GET   /api/coach/promote/profile` — current workspace profile (or empty).
- `PATCH /api/coach/promote/profile` — upsert `{ discipline?, tone?, platform?, booking_url?, signature? }`.

**Change — generation:**
- `POST /api/coach/promote/generate` + `lib/promote-content.ts` accept optional `platform` and thread it into the system prompt (IG vs FB: caption length + hashtag strategy). `booking_url`/`signature` from profile optionally woven into CTA. Backward compatible (all optional).

**Change — video PATCH (bug fix):**
- `PATCH /api/videos/[id]` + `patchVideoSchema` accept `category_id: string | null` and write it (so single-edit moves tabs). Keep legacy `category` accepted but no longer the source of truth for filtering. Validate `category_id` belongs to the workspace (RLS already scopes, but reject unknown ids).

**Validation (all new routes — zod, mirroring `lib/validations.ts`):**
- `content` JSONB is validated against a strict `Post`/`VideoPlan` zod schema **before** insert/update — never store an unshaped object. Reject on mismatch (400).
- `promote_profile` upsert: explicit `workspace_id = current_workspace_id()` (server-derived, never from body) + `onConflict: 'workspace_id'`; RLS is the backstop, the filter is explicit. `booking_url` ≤ 300 chars + URL-shaped; `signature` ≤ 200; `discipline` ≤ 80.
- Every write goes through `requireCoach` (server-derived `workspaceId`/`coachId`) — body never supplies identity columns.

---

## 5. Component changes

### Promote (`app/coach/promote/`)
- **`promote-shared.tsx`** — `PostCard`/`VideoPlanCard` gain an **edit mode** (textareas for hook/caption/CTA, editable hashtag + on-screen-text lists) with an `onChange(content)` callback; add a `PlatformToggle` (IG/FB) and a small `SavedBadge`. Add `postTitle(content)` helper.
- **`PromotePageContent.tsx`** — load Brand Voice on mount (replaces localStorage as source of truth; localStorage kept as offline fallback). On a successful result, **POST to `/posts`** (auto-save draft) and hold the `id`; inline edits PATCH it; show **Save/Posted** + **Start over**. Read `?video=<id>` query → open Video path with that clip preselected. Add a **"Saved posts"** entry point (a shelf view: list of drafts/posted with re-open / copy / mark-posted / delete).
- **`PathStep.tsx`** — unchanged structure; verify true-375 stack (expected already correct).
- **`IdeaStep.tsx`** — "Give me 5 ideas" gets a `×5` cue; ideas render as a tidier stack.
- **`ChatStep.tsx`** — 3 starter-prompt chips that fill the input (kills blank-canvas).
- **`VideoStep.tsx`** — accept `initialVideoId`; real **labeled "OR" divider** between upload and describe; drop hardcoded `kind:'workout'` (use a neutral default / infer).
- **New `SavedPosts.tsx`** — the shelf (list + row actions), used by PromotePageContent.
- Stepper label: unify step 3 to a single consistent label across paths.

### Library (`app/coach/videos/`)
- **`VideosPageContent.tsx`** —
  - **Search** input (title contains) + **Sort** dropdown (Newest / Oldest / Name A–Z / Longest) applied to `filteredVideos` (client-side; all rows already fetched).
  - **Hide "Uncategorized" tab** when `categories.length === 0` (it duplicates "All").
  - **Mobile header**: collapse "Import from Drive / Drive settings / How do I add…" into an overflow **⋯** menu below a breakpoint; keep **Upload** primary always visible.
  - **`VideoManageModal`** category field → a **select of existing categories** (writes `category_id`) + "＋ New category" inline; remove the dead free-text path. Wire `onSaved` to update `category_id` so the card re-tabs immediately.
  - **`StorageMeter`** → minimum visible fill (≥ ~2%) when `usedBytes > 0`.
  - **`VideoCard`** → ⋯ menu **always visible** (not hover-gated); replace leftover crimson (`--color-accent` / `rgba(159,18,57)`) with brass (`--accent`); nicer empty-thumbnail (subtle gradient + play glyph) instead of flat black; add a **"Use in Promote"** item linking to `/coach/promote?video=<id>`.
- **Stretch (if time):** rename-on-upload prompt + **auto-title from transcript** (Bunny captions already captured in `bunny/status`); custom thumbnail / pick-a-frame.

---

## 6. Build order (big visible rocks first)

1. **Migration + types + API skeletons** (promote_posts, promote_profile; routes; `generate` platform param). Apply migration to prod (additive). `tsc` green.
2. **Library Search + Sort** — fast, high-visibility, zero-risk.
3. **Library "Use in Promote"** + Promote `?video=` preselect — closes the loop (touches both).
4. **Promote inline-edit + auto-save (Saved Posts shelf)** — the headline.
5. **Promote Brand Voice** (load/persist) + **Platform toggle**.
6. **Category bug fix** (PATCH `category_id` + select UI).
7. **Mobile** (verify true-375; library header overflow menu; ⋯ discoverability).
8. **Polish batch** (step-3 label, OR divider, chat starters, ×5, storage fill, crimson→brass, empty-thumb).
9. **Stretch** (rename-on-upload / auto-title) only if the night has room.

`next build` + `tsc` green at every commit. Commit in focused chunks with clear messages. **No deploy** — staged for a morning review + deploy together.

---

## 7. Verification
- `npx tsc --noEmit` + `npm run build` green after each phase.
- Targeted Playwright (demo coach `coach@example.com` / `Demo123!`) for: library search/sort, use-in-Promote handoff, save→edit→mark-posted, category single-edit re-tabs. Keep prod-DB load light (the prod Supabase is small — no heavy/repeated query loops).
- True-375 screenshots for the two mobile claims before/after.

## 8. Risks / handoff
- **Supabase MCP may be read-only** → if `apply_migration` is refused, the migration is **staged** (file written) and flagged for a 10-second morning apply; all code still builds. (Owner approved applying overnight; this is the fallback.)
- No deploy overnight. Morning checklist: review diff → confirm migration applied → `npx vercel --prod`.
- Multi-clip editor spec drafted separately (`docs/superpowers/specs/2026-06-05-multiclip-video-editor-design.md`), **no code**.
- Reversible: feature branch commits, additive schema, no edits to existing tables/RLS.
