# Coach Studio — Phase 3a (Scheduling UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A coach can schedule a finished reel to post — pick a saved video, a date/time, platforms, and a caption (AI-draftable) — and see/manage all scheduled posts in a Studio "Scheduled" tab. **The executor (cron that actually sends reminders) is OUT of this plan** (gated on an infra decision: Vercel Pro / n8n / daily-batch); posts simply persist as `scheduled`.

**Architecture:** A new `scheduled_posts` table (workspace-scoped RLS, like the other Studio tables). A scheduled post references a **`videos` row** (the saved reel — Bunny CDN, long-lived) plus optional `project_id` provenance. CRUD API under `/api/studio/scheduled`. A "Scheduled" tab in the Studio area with a list + an inline create form that reuses Promote's AI caption generator (`POST /api/coach/promote/generate`).

**Tech Stack:** Next.js 16, TypeScript, Supabase + RLS, Zod. **No new npm packages. No cron/executor.**

**Spec:** `docs/superpowers/specs/2026-06-05-coach-studio-design.md` (§6 Publishing). Builds on Phases 1–2 + the karaoke work.

## Testing approach (same as prior phases)
Logic → `npx tsx scripts/_studio-check4.ts`. Routes → `tsc` + unauth `curl` (401). UI → `npm run build` + browser smoke. Stop dev before `npm run build`. Commit per task. Branch `rebuild/v2`.

## ⚠️ Owner prereqs
- Apply the Task 1 migration `supabase/migrations/20260605030000_scheduled_posts.sql` (SQL editor).
- **Decide the executor** (Vercel Pro / n8n schedule trigger / daily-batch) — needed in a LATER plan (Phase 3a-executor) to actually fire reminders. This plan ships the UI + data only.

## File structure
**Created:** `supabase/migrations/20260605030000_scheduled_posts.sql`; `lib/studio/scheduled.ts` (schema + platform consts); `app/api/studio/scheduled/route.ts` (GET/POST); `app/api/studio/scheduled/[id]/route.ts` (PATCH/DELETE); `app/coach/studio/StudioTabs.tsx` (Projects | Scheduled nav); `app/coach/studio/scheduled/page.tsx` + `ScheduledContent.tsx` (list); `app/coach/studio/scheduled/ScheduleForm.tsx` (create form); `scripts/_studio-check4.ts` (throwaway).
**Modified:** `app/coach/studio/projects/page.tsx` (mount StudioTabs); `app/coach/studio/RenderPanel.tsx` (add "Schedule this" after save-to-library).

---

## Task 1: Migration — `scheduled_posts`

**Files:** Create `supabase/migrations/20260605030000_scheduled_posts.sql`

- [ ] **Step 1: Write the migration** (workspace-scoped RLS copied from `video_projects`)
```sql
-- Coach Studio Phase 3a: scheduled posts (reminder-share now; auto-post in Phase 4). ADDITIVE.
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,           -- the saved reel to post
  project_id UUID REFERENCES public.video_projects(id) ON DELETE SET NULL, -- provenance (optional)
  platforms TEXT[] NOT NULL DEFAULT '{}',                                  -- e.g. {instagram,facebook}
  caption TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  mode TEXT NOT NULL DEFAULT 'share' CHECK (mode IN ('share','auto')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','reminded','posted','failed','canceled')),
  posted_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workspace_time
  ON public.scheduled_posts(workspace_id, scheduled_at);
-- For the future executor: find due posts efficiently.
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON public.scheduled_posts(status, scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_posts_select_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_select_workspace" ON public.scheduled_posts
  FOR SELECT USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "scheduled_posts_insert_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_insert_workspace" ON public.scheduled_posts
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "scheduled_posts_update_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_update_workspace" ON public.scheduled_posts
  FOR UPDATE USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "scheduled_posts_delete_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_delete_workspace" ON public.scheduled_posts
  FOR DELETE USING (workspace_id = current_workspace_id());
NOTIFY pgrst, 'reload schema';
```
- [ ] **Step 2: Commit (staged)** `git add` + `git commit -m "feat(studio): staged migration — scheduled_posts"`
- [ ] **Step 3: Owner applies + verify:** `select count(*) ... pg_policies where tablename='scheduled_posts'` → 4.

---

## Task 2: `lib/studio/scheduled.ts` schema + CRUD API

**Files:** Create `lib/studio/scheduled.ts`, `app/api/studio/scheduled/route.ts`, `app/api/studio/scheduled/[id]/route.ts`; Test `scripts/_studio-check4.ts`

- [ ] **Step 1: Failing check** `scripts/_studio-check4.ts`
```ts
import assert from 'node:assert'
import { CreateScheduleSchema, PLATFORMS } from '../lib/studio/scheduled'
assert.ok(PLATFORMS.includes('instagram'), 'has instagram')
const ok = CreateScheduleSchema.safeParse({ videoId: '11111111-1111-4111-8111-111111111111', platforms: ['instagram'], caption: 'hi', scheduledAt: '2026-07-01T15:00:00.000Z' })
assert.ok(ok.success, 'valid create parses')
assert.ok(!CreateScheduleSchema.safeParse({ videoId: 'x', platforms: [], caption: '', scheduledAt: 'nope' }).success, 'invalid rejected')
assert.ok(!CreateScheduleSchema.safeParse({ videoId: '11111111-1111-4111-8111-111111111111', platforms: ['myspace'], caption: 'hi', scheduledAt: '2026-07-01T15:00:00.000Z' }).success, 'bad platform rejected')
console.log('OK scheduled schema')
```
Run `npx tsx scripts/_studio-check4.ts` → fails.

- [ ] **Step 2: `lib/studio/scheduled.ts`**
```ts
import { z } from 'zod'
export const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const
export type Platform = (typeof PLATFORMS)[number]
export const CreateScheduleSchema = z.object({
  videoId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(4),
  caption: z.string().max(2200).default(''),
  scheduledAt: z.string().datetime(),
})
export const PatchScheduleSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(4).optional(),
  caption: z.string().max(2200).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'canceled']).optional(), // UI may only cancel/reactivate
}).refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })
```

- [ ] **Step 3: `app/api/studio/scheduled/route.ts`** (GET list + POST create — mirror `app/api/studio/projects/route.ts` patterns: `requireCoach`, request-scoped `supabase` for reads, `createServiceClient` for writes, validate `video_id` belongs to the workspace before insert)
```ts
import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { CreateScheduleSchema } from '@/lib/studio/scheduled'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth
  const { data, error } = await supabase.from('scheduled_posts')
    .select('id, video_id, project_id, platforms, caption, scheduled_at, mode, status, posted_at, error')
    .eq('workspace_id', workspaceId).order('scheduled_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load scheduled posts' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth
  const parsed = CreateScheduleSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { videoId, projectId, platforms, caption, scheduledAt } = parsed.data
  const service = createServiceClient()
  // verify the video belongs to this workspace (never trust a client id)
  const { data: vid } = await service.from('videos').select('id').eq('id', videoId).eq('workspace_id', workspaceId).maybeSingle()
  if (!vid) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  const { data, error } = await service.from('scheduled_posts').insert({
    workspace_id: workspaceId, coach_id: user.id, video_id: videoId,
    project_id: projectId ?? null, platforms, caption, scheduled_at: scheduledAt,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Could not schedule' }, { status: 500 })
  return NextResponse.json({ data: { id: data.id } }, { status: 201 })
}
```

- [ ] **Step 4: `app/api/studio/scheduled/[id]/route.ts`** (PATCH edit/cancel + DELETE — mirror `app/api/studio/projects/[id]/route.ts`, incl. the 404-on-zero-row pattern via `.select('id').maybeSingle()`)
```ts
import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { PatchScheduleSchema } from '@/lib/studio/scheduled'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const parsed = PatchScheduleSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.platforms !== undefined) patch.platforms = parsed.data.platforms
  if (parsed.data.caption !== undefined) patch.caption = parsed.data.caption
  if (parsed.data.scheduledAt !== undefined) patch.scheduled_at = parsed.data.scheduledAt
  if (parsed.data.status !== undefined) patch.status = parsed.data.status
  const service = createServiceClient()
  const { data, error } = await service.from('scheduled_posts').update(patch)
    .eq('id', id).eq('workspace_id', workspaceId).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service.from('scheduled_posts').delete()
    .eq('id', id).eq('workspace_id', workspaceId).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not delete' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { ok: true } })
}
```

- [ ] **Step 5: Verify** `npx tsx scripts/_studio-check4.ts` → `OK scheduled schema`; `npx tsc --noEmit` clean; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/studio/scheduled` → 401.
- [ ] **Step 6: Commit** `git add lib/studio/scheduled.ts app/api/studio/scheduled scripts/_studio-check4.ts` + `git commit -m "feat(studio): scheduled_posts schema + CRUD API"` (end body with the Co-Authored-By trailer).

---

## Task 3: Studio tabs + Scheduled list page

**Files:** Create `app/coach/studio/StudioTabs.tsx`, `app/coach/studio/scheduled/page.tsx`, `app/coach/studio/scheduled/ScheduledContent.tsx`; Modify `app/coach/studio/projects/page.tsx`

- [ ] **Step 1: `StudioTabs.tsx`** — a client tab strip (Projects | Scheduled) using `usePathname`; active = brass underline matching the app's existing `Tabs` primitive style (read `components/ui/Tabs.tsx` and reuse it if its API fits; otherwise a simple two-link strip).
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
const TABS = [{ href: '/coach/studio/projects', label: 'Projects' }, { href: '/coach/studio/scheduled', label: 'Scheduled' }]
export function StudioTabs() {
  const path = usePathname()
  return (
    <div className="mb-4 flex gap-1 border-b border-white/10">
      {TABS.map((t) => {
        const active = path === t.href
        return <Link key={t.href} href={t.href} className={`px-4 py-2 text-sm font-medium ${active ? 'border-b-2 border-[var(--accent)] text-white' : 'text-white/60 hover:text-white'}`}>{t.label}</Link>
      })}
    </div>
  )
}
```
- [ ] **Step 2: Mount `<StudioTabs />`** in `app/coach/studio/projects/page.tsx` (right under the `PageHeader`).
- [ ] **Step 3: `app/coach/studio/scheduled/page.tsx`**
```tsx
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { StudioTabs } from '../StudioTabs'
import { ScheduledContent } from './ScheduledContent'
export const dynamic = 'force-dynamic'
export default function ScheduledPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader title="Studio" icon={<Icon name="studio" />} />
      <StudioTabs />
      <ScheduledContent />
    </div>
  )
}
```
(Match the real `PageHeader` prop usage from `projects/page.tsx`.)
- [ ] **Step 4: `ScheduledContent.tsx`** — client list: GET `/api/studio/scheduled`, render rows (caption preview, platforms, local date/time via `new Date(scheduled_at).toLocaleString()`, status badge), with Cancel (PATCH status:'canceled') + Delete (DELETE) actions, and a "Schedule a post" button that toggles `<ScheduleForm onCreated={reload} />` (Task 4). Use `Card`/`EmptyState` (props: `EmptyState` uses `description`). Empty → EmptyState "No scheduled posts yet." Show a small note: *"Posts are saved here; automatic sending turns on once the scheduler is configured."*
  (Full code follows the exact shape of `app/coach/studio/projects/ProjectsContent.tsx` — fetch, map, action buttons, `encodeURIComponent` on ids. Reuse that file as the template.)
- [ ] **Step 5: Verify** `npm run build` green; browser: `/coach/studio/scheduled` renders, tab switching works.
- [ ] **Step 6: Commit** `git add app/coach/studio/StudioTabs.tsx app/coach/studio/scheduled app/coach/studio/projects/page.tsx` + commit (trailer).

---

## Task 4: Create-schedule form (+ AI caption) + RenderPanel "Schedule this"

**Files:** Create `app/coach/studio/scheduled/ScheduleForm.tsx`; Modify `app/coach/studio/RenderPanel.tsx`

- [ ] **Step 1: `ScheduleForm.tsx`** — a client form with:
  - **Video picker:** GET `/api/videos?status=ready`, a `<select>` of the coach's videos (id + title); preselect a `defaultVideoId` prop if given.
  - **Date/time:** `<input type="datetime-local">` → convert to ISO (`new Date(value).toISOString()`) for `scheduledAt`.
  - **Platforms:** checkboxes for `PLATFORMS` (from `@/lib/studio/scheduled`).
  - **Caption:** `<textarea>` + a **"Draft with AI"** button → `POST /api/coach/promote/generate` with body `{ kind: 'bts', mode: 'post', platform: <first selected or 'instagram'>, topic: <selected video title> }`; on success set the textarea to `data.post.caption + '\n\n' + data.post.hashtags.map(h=>'#'+h).join(' ')` (read the real response shape: `{ data: { mode:'post', post: { caption, hashtags[] } } }`).
  - **Submit** → `POST /api/studio/scheduled` with `{ videoId, platforms, caption, scheduledAt }`; on 201 call `onCreated()`. Disable submit unless a video + ≥1 platform + a future datetime are set. Surface errors.
  Props: `{ defaultVideoId?: string; onCreated: () => void; onCancel: () => void }`.
- [ ] **Step 2: RenderPanel "Schedule this".** In `app/coach/studio/RenderPanel.tsx`, after a successful **Save to library** (it returns `{ data: { videoId } }`), store that `videoId` and show a **"Schedule this"** link → `router.push('/coach/studio/scheduled?video=' + videoId)` (use `next/navigation` `useRouter`). The Scheduled page reads `?video=` and opens `ScheduleForm` with `defaultVideoId` preselected. (Wire `ScheduledContent` to read the `?video=` searchparam and auto-open the form.)
- [ ] **Step 3: Verify** `npm run build` green; browser smoke (migration applied): Scheduled tab → "Schedule a post" → pick a ready video, pick a time + platforms, "Draft with AI" fills the caption, submit → the post appears in the list as `scheduled`; Cancel/Delete work. From a render → Save to library → "Schedule this" → form opens with the video preselected.
- [ ] **Step 4: Commit** `git add app/coach/studio/scheduled/ScheduleForm.tsx app/coach/studio/RenderPanel.tsx` + commit (trailer).

---

## Task 5: Cleanup + build gate
- [ ] `git rm scripts/_studio-check4.ts && git commit -m "chore(studio): remove phase-3a test harness"` (trailer).
- [ ] Stop dev; `npm run build` → green.

## Self-review
- **scheduled_posts table + RLS** → T1. **CRUD** → T2 (workspace-scoped; video ownership verified; 404-on-zero-row). **Scheduled tab + list + cancel/delete** → T3. **Create flow (video + time + platforms + caption + AI draft)** → T4. **Schedule-from-render** → T4 RenderPanel. **AI caption reuse** → T4 (`/api/coach/promote/generate` mode:'post'). 
- **Executor deliberately OUT** (cron gated on infra decision) — posts persist as `scheduled`; the list notes sending isn't active yet. The `idx_scheduled_posts_due` partial index is pre-laid for that executor.
- **Type consistency:** `PLATFORMS`/`Platform` single-sourced in `lib/studio/scheduled.ts`; API + form import from it. Scheduled post references `videos.id` (long-lived Bunny), matching the investigation + `promote_posts.source_video_id` precedent.
- **No new packages, no schema beyond the one additive table.**

## Execution
Subagent-driven, autonomous. Owner prereqs: apply the Task 1 migration; decide the executor (separate Phase 3a-executor plan).
