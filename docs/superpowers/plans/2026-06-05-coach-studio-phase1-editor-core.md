# Coach Studio — Phase 1 (Editor Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable multi-clip editor: pick clips from the library → trim/split/reorder → render one captioned 1080×1920 MP4 on the existing Lambda → save it to the library, rename, and download. All under a new **Studio** area.

**Architecture:** Extends the deployed Bunny + Remotion-on-Lambda pipeline. The editor builds a **timeline JSON** persisted to a new `video_projects` table; a new `TimelineVideo` Remotion composition renders that JSON with a `<Series>` of `<OffthreadVideo>` segments (center-cover crop kills the letterbox bug). A project-mode render route reuses the existing guards, `after()` kickoff, and status polling. Output is re-ingested to Bunny as a new `videos` row for the library.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Tailwind v4, Supabase (Postgres + RLS), Remotion 4 on AWS Lambda, Bunny Stream, Zod.

**Spec:** `docs/superpowers/specs/2026-06-05-coach-studio-design.md` (Phase 1 section). Phases 2–4 get their own plans.

---

## Testing approach for THIS repo (read first)

The repo's `jest` is **integration-only** (numbered `__tests__/0N-*.test.ts`, shared state, hits a live server). So this plan uses:
- **Pure-logic tasks** → TDD with a throwaway `npx tsx scripts/_studio-check.ts` (write failing assertions → implement → pass). Keep the script until Phase 1 ends, then delete.
- **API/route tasks** → `npx tsc --noEmit` + an **unauthenticated `curl` probe** (expect `401`/`400`, proving the route module loads and guards run) + `next build`.
- **UI tasks** → `next build` + a **browser smoke** as the demo coach (`coach@example.com` / `Demo123!`, http://localhost:3000).

**Build gate (Windows):** `next dev` and `next build` fight over `.next`. **Stop the dev server before `npm run build`,** restart after. Run dev with `UPSTASH_REDIS_REST_URL=' ' UPSTASH_REDIS_REST_TOKEN=' '` so auth pages aren't slowed.

**Commit after every task.** We work on branch `rebuild/v2`.

---

## ⚠️ Owner / infra prerequisites (NOT code — call these out during execution)

1. **Apply the staged migration** from Task 1 (`supabase/migrations/20260605010000_studio_video_projects.sql`) via the Supabase dashboard SQL editor. The MCP is read-only; the build can't apply it. Until applied, Studio save/render degrade (project create returns an error). *(Per CLAUDE.md: no schema changes without owner; this is staged for the owner.)*
2. **Re-deploy the Remotion Lambda site** after Task 4 so Lambda knows the new `TimelineVideo` composition. Needs the `REMOTION_AWS_*` creds in env:
   ```bash
   npx remotion lambda sites create remotion/index.ts --site-name=kindo-captioned
   ```
   Then confirm `REMOTION_APP_SERVE_URL` still points at `kindo-captioned` (the redeploy keeps the name). **Without this, project renders fail with "composition TimelineVideo not found."** Single-clip renders are unaffected.

---

## File structure (what gets created / modified)

**Created**
- `supabase/migrations/20260605010000_studio_video_projects.sql` — `video_projects` table + RLS + additive `video_edits.project_id`.
- `lib/studio/timeline.ts` — TS types + Zod schemas for the timeline/audio JSON + duration/frame math.
- `lib/studio/crop.ts` — normalized crop rect → CSS cover style.
- `lib/studio/captions.ts` — per-clip caption-cue offsetting + merge into render cues.
- `remotion/TimelineVideo.tsx` — multi-clip composition.
- `app/api/studio/projects/route.ts` — GET list / POST create.
- `app/api/studio/projects/[id]/route.ts` — GET / PATCH / DELETE one project.
- `app/api/studio/render/route.ts` — project-mode render kickoff.
- `app/api/studio/save-to-library/route.ts` — re-ingest a rendered MP4 to Bunny + create a `videos` row.
- `app/coach/studio/page.tsx` — redirect to `/coach/studio/projects`.
- `app/coach/studio/projects/page.tsx` + `app/coach/studio/projects/ProjectsContent.tsx` — Projects list.
- `app/coach/studio/edit/page.tsx` — editor route (`?project=<id>`).
- `app/coach/studio/StudioEditor.tsx` — the timeline editor (client component).
- `app/coach/studio/RenderPanel.tsx` — render + deliver (progress/download/save/rename).
- `scripts/_studio-check.ts` — throwaway TDD harness (deleted at phase end).

**Modified**
- `lib/remotion.ts` — add `startTimelineRender()` + `TimelineRenderInput` type.
- `remotion/Root.tsx` — register the `TimelineVideo` `<Composition>`.
- `components/icons/inked.tsx` — add `'studio'` to `InkedIconName` + `PATHS`.
- `app/coach/CoachSidebarShell.tsx` — add Studio to the "Grow" section.
- `app/coach/CoachMoreSheet.tsx` — add Studio to the "Grow" group.
- `lib/bunny.ts` — add `fetchBunnyVideoFromUrl()` (Bunny "fetch from URL" ingest).

---

## Task 1: Staged migration — `video_projects` + `video_edits.project_id`

**Files:**
- Create: `supabase/migrations/20260605010000_studio_video_projects.sql`

- [ ] **Step 1: Write the migration** (copies the exact `video_edits` RLS pattern; `current_workspace_id()` is called bare)

```sql
-- Coach Studio Phase 1: multi-clip editor projects.
-- ADDITIVE ONLY. video_edits already exists (20260528000000). Nothing existing is dropped.

CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  aspect TEXT NOT NULL DEFAULT '9:16',
  caption_style TEXT NOT NULL DEFAULT 'tiktok'
    CHECK (caption_style IN ('tiktok', 'minimal', 'karaoke', 'none')),
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'rendering', 'rendered', 'failed')),
  last_render_edit_id UUID REFERENCES public.video_edits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_projects_workspace_updated
  ON public.video_projects(workspace_id, updated_at DESC);

-- A render job can point at a multi-clip project (source_video_id stays nullable for single-clip).
ALTER TABLE public.video_edits
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.video_projects(id) ON DELETE CASCADE;

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_projects_select_workspace" ON public.video_projects;
CREATE POLICY "video_projects_select_workspace" ON public.video_projects
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_projects_insert_workspace" ON public.video_projects;
CREATE POLICY "video_projects_insert_workspace" ON public.video_projects
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_projects_update_workspace" ON public.video_projects;
CREATE POLICY "video_projects_update_workspace" ON public.video_projects
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_projects_delete_workspace" ON public.video_projects;
CREATE POLICY "video_projects_delete_workspace" ON public.video_projects
  FOR DELETE USING (workspace_id = current_workspace_id());

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Commit (staged — do NOT apply from code)**

```bash
git add supabase/migrations/20260605010000_studio_video_projects.sql
git commit -m "feat(studio): staged migration — video_projects + video_edits.project_id"
```

- [ ] **Step 3: Owner applies + verify** (owner runs the SQL in the dashboard, then verify read-only)

Verify via Supabase MCP `execute_sql` (project `owiqourfyjxwveopijrg`):
```sql
select c.relname, c.relrowsecurity,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='video_projects';
select column_name from information_schema.columns
where table_name='video_edits' and column_name='project_id';
```
Expected: `video_projects` rls=true, policies=4; `project_id` row returned.

---

## Task 2: Timeline types, Zod schemas, duration math

**Files:**
- Create: `lib/studio/timeline.ts`
- Test: `scripts/_studio-check.ts`

- [ ] **Step 1: Write the failing checks** in `scripts/_studio-check.ts`

```ts
import assert from 'node:assert'
import { TimelineSchema, ProjectAudioSchema, totalDurationSec, clipFrameRanges, FPS } from '../lib/studio/timeline'

// valid 2-clip timeline parses
const tl = [
  { sourceVideoId: '11111111-1111-1111-1111-111111111111', inSec: 0, outSec: 3, captionsOn: true },
  { sourceVideoId: '22222222-2222-2222-2222-222222222222', inSec: 1, outSec: 5.5, captionsOn: false },
]
assert.ok(TimelineSchema.safeParse(tl).success, 'valid timeline should parse')

// out<=in rejected
assert.ok(!TimelineSchema.safeParse([{ sourceVideoId: '11111111-1111-1111-1111-111111111111', inSec: 3, outSec: 3 }]).success, 'out<=in rejects')

// empty audio object is valid; volumes clamp shape
assert.ok(ProjectAudioSchema.safeParse({}).success, 'empty audio ok')
assert.ok(ProjectAudioSchema.safeParse({ volumes: { clip: 1, music: 0.5, voiceover: 1 } }).success, 'audio volumes ok')

// duration = sum of (out-in) = 3 + 4.5 = 7.5
assert.strictEqual(totalDurationSec(tl), 7.5, 'total duration sums clip lengths')

// frame ranges: clip0 [0,90), clip1 [90, 90+135=225)
const ranges = clipFrameRanges(tl)
assert.deepStrictEqual(ranges[0], { fromFrame: 0, durationInFrames: 90 }, 'clip0 frames')
assert.deepStrictEqual(ranges[1], { fromFrame: 90, durationInFrames: 135 }, 'clip1 frames')

console.log('OK studio/timeline')
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx tsx scripts/_studio-check.ts`
Expected: FAIL — `Cannot find module '../lib/studio/timeline'`.

- [ ] **Step 3: Implement `lib/studio/timeline.ts`**

```ts
import { z } from 'zod'

export const FPS = 30
export const FRAME_W = 1080
export const FRAME_H = 1920
export const MAX_CLIPS = 8
export const MAX_TOTAL_SEC = 90

export const CropSchema = z.object({
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  w: z.number().min(0).max(1), h: z.number().min(0).max(1),
})
export type Crop = z.infer<typeof CropSchema>

export const TimelineClipSchema = z.object({
  sourceVideoId: z.string().uuid(),
  inSec: z.number().min(0).default(0),
  outSec: z.number().positive(),
  crop: CropSchema.nullable().default(null),
  captionsOn: z.boolean().default(true),
}).refine((c) => c.outSec > c.inSec, { message: 'Clip end must be after its start' })
export type TimelineClip = z.infer<typeof TimelineClipSchema>

export const TimelineSchema = z.array(TimelineClipSchema).max(MAX_CLIPS)
export type Timeline = z.infer<typeof TimelineSchema>

export const ProjectAudioSchema = z.object({
  musicAssetId: z.string().uuid().nullable().default(null),
  voiceoverAssetId: z.string().uuid().nullable().default(null),
  volumes: z.object({
    clip: z.number().min(0).max(1).default(1),
    music: z.number().min(0).max(1).default(0.5),
    voiceover: z.number().min(0).max(1).default(1),
  }).default({ clip: 1, music: 0.5, voiceover: 1 }),
}).default({})
export type ProjectAudio = z.infer<typeof ProjectAudioSchema>

export const CAPTION_STYLES = ['tiktok', 'minimal', 'karaoke', 'none'] as const
export type CaptionStyle = (typeof CAPTION_STYLES)[number]

export function clipLenSec(c: Pick<TimelineClip, 'inSec' | 'outSec'>): number {
  return Math.max(0, c.outSec - c.inSec)
}
export function totalDurationSec(tl: Pick<TimelineClip, 'inSec' | 'outSec'>[]): number {
  return Number(tl.reduce((s, c) => s + clipLenSec(c), 0).toFixed(3))
}
export function clipFrameRanges(tl: Pick<TimelineClip, 'inSec' | 'outSec'>[]): { fromFrame: number; durationInFrames: number }[] {
  let cursor = 0
  return tl.map((c) => {
    const durationInFrames = Math.round(clipLenSec(c) * FPS)
    const range = { fromFrame: cursor, durationInFrames }
    cursor += durationInFrames
    return range
  })
}
export function totalFrames(tl: Pick<TimelineClip, 'inSec' | 'outSec'>[]): number {
  return Math.max(1, clipFrameRanges(tl).reduce((s, r) => s + r.durationInFrames, 0))
}
```

- [ ] **Step 4: Run checks; verify pass**

Run: `npx tsx scripts/_studio-check.ts`
Expected: `OK studio/timeline`

- [ ] **Step 5: Commit**

```bash
git add lib/studio/timeline.ts scripts/_studio-check.ts
git commit -m "feat(studio): timeline types, zod schemas, duration/frame math"
```

---

## Task 3: Crop + caption-cue offset helpers

**Files:**
- Create: `lib/studio/crop.ts`, `lib/studio/captions.ts`
- Test: append to `scripts/_studio-check.ts`

- [ ] **Step 1: Append failing checks** to `scripts/_studio-check.ts`

```ts
import { coverStyle } from '../lib/studio/crop'
import { offsetCues } from '../lib/studio/captions'

// default (null crop) → objectFit cover, no transform offset
const s0 = coverStyle(null)
assert.strictEqual(s0.objectFit, 'cover', 'cover by default')

// explicit crop rect produces a scale>1 transform string
const s1 = coverStyle({ x: 0.25, y: 0, w: 0.5, h: 1 })
assert.ok(typeof s1.transform === 'string' && s1.transform.includes('scale'), 'crop yields scale transform')

// offsetCues shifts each cue by the clip's timeline start (ms) and trims to clip window
const cues = [{ startMs: 1000, endMs: 2000, text: 'a' }, { startMs: 4000, endMs: 5000, text: 'b' }]
// clip in=0.5s out=2.0s, placed at timeline start 3.0s → keep cue 'a' (overlaps window), drop 'b'
const out = offsetCues(cues, { inSec: 0.5, outSec: 2.0, startSec: 3.0 })
assert.strictEqual(out.length, 1, 'only in-window cue kept')
assert.strictEqual(out[0].text, 'a', 'kept cue a')
assert.ok(out[0].startMs >= 3000, 'cue shifted onto timeline')

console.log('OK studio/crop+captions')
```

- [ ] **Step 2: Run; verify fails**

Run: `npx tsx scripts/_studio-check.ts`
Expected: FAIL — `Cannot find module '../lib/studio/crop'`.

- [ ] **Step 3: Implement `lib/studio/crop.ts`**

```ts
import type { CSSProperties } from 'react'
import type { Crop } from './timeline'

// Maps a normalized source crop rect to a CSS style that fills the 9:16 frame.
// null → plain center cover (fixes the legacy letterbox for landscape sources).
export function coverStyle(crop: Crop | null): CSSProperties {
  if (!crop) return { width: '100%', height: '100%', objectFit: 'cover' }
  const scale = 1 / Math.max(crop.w || 1, 0.0001)
  const txPct = (0.5 - (crop.x + crop.w / 2)) * 100 * scale
  const tyPct = (0.5 - (crop.y + crop.h / 2)) * 100 * scale
  return {
    width: '100%', height: '100%', objectFit: 'cover',
    transform: `scale(${scale.toFixed(4)}) translate(${txPct.toFixed(2)}%, ${tyPct.toFixed(2)}%)`,
    transformOrigin: 'center',
  }
}
```

- [ ] **Step 4: Implement `lib/studio/captions.ts`**

```ts
import type { Caption } from '@/lib/bunny' // { startMs, endMs, text }

// Shift a source clip's cues onto the timeline: subtract the clip's trim-in,
// keep only cues that fall inside the trimmed window, then add the clip's
// timeline start offset. Returns cues in timeline-time (ms).
export function offsetCues(
  cues: Caption[],
  clip: { inSec: number; outSec: number; startSec: number },
): Caption[] {
  const inMs = clip.inSec * 1000
  const outMs = clip.outSec * 1000
  const startMs = clip.startSec * 1000
  const out: Caption[] = []
  for (const c of cues) {
    if (c.endMs <= inMs || c.startMs >= outMs) continue // outside trim window
    const s = Math.max(c.startMs, inMs) - inMs + startMs
    const e = Math.min(c.endMs, outMs) - inMs + startMs
    out.push({ startMs: Math.round(s), endMs: Math.round(e), text: c.text })
  }
  return out
}
```

- [ ] **Step 5: Run; verify pass**

Run: `npx tsx scripts/_studio-check.ts`
Expected: `OK studio/timeline` then `OK studio/crop+captions`.

- [ ] **Step 6: Commit**

```bash
git add lib/studio/crop.ts lib/studio/captions.ts scripts/_studio-check.ts
git commit -m "feat(studio): crop cover-style + caption-cue offset helpers"
```

---

## Task 4: `TimelineVideo` Remotion composition

**Files:**
- Create: `remotion/TimelineVideo.tsx`
- Modify: `remotion/Root.tsx` (register the composition)

- [ ] **Step 1: Implement `remotion/TimelineVideo.tsx`** (mirrors `CaptionedClip`'s caption logic; one `<Series.Sequence>` per clip; center-cover crop)

```tsx
import { AbsoluteFill, OffthreadVideo, Series, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CSSProperties } from 'react'

export type TimelineRenderClip = {
  mp4Url: string
  inSec: number
  outSec: number
  crop: { x: number; y: number; w: number; h: number } | null
  captionsOn: boolean
}
export type TimelineCaption = { text: string; startMs: number; endMs: number } // timeline-time
export type TimelineVideoProps = {
  clips: TimelineRenderClip[]
  captions: TimelineCaption[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
}

const FPS = 30
const tiktokStyle: CSSProperties = { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 64, lineHeight: 1.1, color: 'white', textAlign: 'center', WebkitTextStroke: '8px black', paintOrder: 'stroke fill', textShadow: '0 4px 24px rgba(0,0,0,0.5)', maxWidth: '88%' }
const minimalStyle: CSSProperties = { fontWeight: 600, fontSize: 46, lineHeight: 1.2, color: 'white', backgroundColor: 'rgba(0,0,0,0.55)', padding: '12px 24px', borderRadius: 12, maxWidth: '88%' }

function coverStyle(crop: TimelineRenderClip['crop']): CSSProperties {
  if (!crop) return { width: '100%', height: '100%', objectFit: 'cover' }
  const scale = 1 / Math.max(crop.w || 1, 0.0001)
  const tx = (0.5 - (crop.x + crop.w / 2)) * 100 * scale
  const ty = (0.5 - (crop.y + crop.h / 2)) * 100 * scale
  return { width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty}%)`, transformOrigin: 'center' }
}

function CaptionLayer({ captions, captionStyle }: { captions: TimelineCaption[]; captionStyle: TimelineVideoProps['captionStyle'] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (captionStyle === 'none') return null
  const ms = (frame / fps) * 1000
  const active = captions.find((c) => ms >= c.startMs && ms < c.endMs)
  if (!active) return null
  // Phase 1: 'karaoke' falls back to the tiktok look (true word-by-word lands in Phase 3).
  const style = captionStyle === 'minimal' ? minimalStyle : tiktokStyle
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220 }}>
      <span style={style}>{active.text}</span>
    </AbsoluteFill>
  )
}

export function TimelineVideo({ clips, captions, captionStyle }: TimelineVideoProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Series>
        {clips.map((clip, i) => {
          const durationInFrames = Math.max(1, Math.round((clip.outSec - clip.inSec) * FPS))
          return (
            <Series.Sequence key={i} durationInFrames={durationInFrames}>
              <AbsoluteFill>
                <OffthreadVideo
                  src={clip.mp4Url}
                  trimBefore={Math.round(clip.inSec * FPS)}
                  trimAfter={Math.round(clip.outSec * FPS)}
                  style={coverStyle(clip.crop)}
                />
              </AbsoluteFill>
            </Series.Sequence>
          )
        })}
      </Series>
      <CaptionLayer captions={captions} captionStyle={captionStyle} />
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Register it in `remotion/Root.tsx`** (add alongside the existing `CaptionedClip` `<Composition>`)

```tsx
// import at top:
import { TimelineVideo, type TimelineVideoProps } from './TimelineVideo'

// inside <> … </> after the CaptionedClip Composition:
<Composition
  id="TimelineVideo"
  component={TimelineVideo}
  durationInFrames={FPS * 10}
  fps={FPS}
  width={WIDTH}
  height={HEIGHT}
  defaultProps={{ clips: [], captions: [], captionStyle: 'tiktok' } as TimelineVideoProps}
  calculateMetadata={({ props }: { props: TimelineVideoProps }) => {
    const seconds = props.clips.reduce((s, c) => s + Math.max(0, c.outSec - c.inSec), 0)
    return { durationInFrames: Math.max(1, Math.round(seconds * FPS)), fps: FPS, width: WIDTH, height: HEIGHT }
  }}
/>
```

- [ ] **Step 3: Verify it renders locally** (write a 2-clip props file; uses any 2 public mp4 URLs — e.g. two `signBunnyUrl` outputs, or Remotion's sample). Keep clips short.

Create `scripts/_timeline-props.json`:
```json
{ "clips": [
  { "mp4Url": "https://remotion.dev/bbb.mp4", "inSec": 0, "outSec": 2, "crop": null, "captionsOn": false },
  { "mp4Url": "https://remotion.dev/bbb.mp4", "inSec": 3, "outSec": 5, "crop": null, "captionsOn": false }
], "captions": [], "captionStyle": "none" }
```
Run: `npx remotion render remotion/index.ts TimelineVideo out/_timeline.mp4 --props=scripts/_timeline-props.json`
Expected: renders a ~4s 1080×1920 MP4 (two 2s segments). Delete `out/_timeline.mp4` + `scripts/_timeline-props.json` after.

- [ ] **Step 4: Commit**

```bash
git add remotion/TimelineVideo.tsx remotion/Root.tsx
git commit -m "feat(studio): TimelineVideo composition (multi-clip Series + center-cover crop)"
```

- [ ] **Step 5: Owner infra step** — re-deploy the Lambda site so the cloud knows `TimelineVideo` (see Prerequisites #2). Note in the execution log that cloud renders won't work until this runs.

---

## Task 5: Project-mode render — `lib/remotion.ts` + `app/api/studio/render/route.ts`

**Files:**
- Modify: `lib/remotion.ts` (add `startTimelineRender`)
- Create: `app/api/studio/render/route.ts`

- [ ] **Step 1: Add `startTimelineRender` to `lib/remotion.ts`** (mirror `startCaptionedRender`, composition `'TimelineVideo'`)

```ts
export type TimelineRenderInput = {
  clips: { mp4Url: string; inSec: number; outSec: number; crop: { x: number; y: number; w: number; h: number } | null; captionsOn: boolean }[]
  captions: { text: string; startMs: number; endMs: number }[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
}

export async function startTimelineRender(input: TimelineRenderInput): Promise<{ renderId: string; bucketName: string }> {
  const { region, functionName, serveUrl } = cfg()
  const { renderId, bucketName } = await renderMediaOnLambda({
    region, functionName, serveUrl,
    composition: 'TimelineVideo',
    inputProps: input,
    codec: 'h264', imageFormat: 'jpeg', privacy: 'public',
    framesPerLambda: 1000,
    downloadBehavior: { type: 'download', fileName: 'kindo-reel.mp4' },
  })
  return { renderId, bucketName }
}
```
(`cfg()` already exists and reads region/functionName/serveUrl. Reuse `getCaptionedRenderStatus` for polling — it's render-id based, composition-agnostic.)

- [ ] **Step 2: Implement `app/api/studio/render/route.ts`** (reuses every guard from the single-clip route; idempotency keyed on `project_id`)

```ts
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { checkDailyWorkspaceQuota } from '@/lib/spend-guard'
import { remotionConfigured, startTimelineRender, type TimelineRenderInput } from '@/lib/remotion'
import { signBunnyUrl, fetchBunnyCaptions } from '@/lib/bunny'
import { logServerError } from '@/lib/log-server-error'
import { TimelineSchema, totalDurationSec, MAX_TOTAL_SEC } from '@/lib/studio/timeline'
import { offsetCues } from '@/lib/studio/captions'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({ projectId: z.string().uuid() })

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { projectId } = parsed.data

  const rate = await checkRateLimitAsync(`studio-render:${user.id}`, { windowMs: 60_000, max: 5, failMode: 'closed' })
  if (!rate.success) return NextResponse.json({ error: 'Too many renders — wait a moment and try again' }, { status: 429, headers: rate.retryAfter ? { 'Retry-After': String(rate.retryAfter) } : undefined })
  const quota = await checkDailyWorkspaceQuota(workspaceId, 'render', 40)
  if (!quota.allowed) return NextResponse.json({ error: 'Daily limit reached for this workspace — try again tomorrow.' }, { status: 429 })
  if (!remotionConfigured()) return NextResponse.json({ error: 'Rendering is not set up yet.' }, { status: 503 })

  const service = createServiceClient()

  // in-flight idempotency per project
  const { data: inFlight } = await service.from('video_edits')
    .select('id').eq('project_id', projectId).eq('workspace_id', workspaceId).eq('status', 'rendering')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (inFlight?.id) return NextResponse.json({ data: { editId: inFlight.id } })

  const { data: project, error: pErr } = await service.from('video_projects')
    .select('id, timeline, caption_style').eq('id', projectId).eq('workspace_id', workspaceId).single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const tl = TimelineSchema.safeParse(project.timeline)
  if (!tl.success || tl.data.length === 0) return NextResponse.json({ error: 'Add at least one clip before rendering' }, { status: 400 })
  if (totalDurationSec(tl.data) > MAX_TOTAL_SEC) return NextResponse.json({ error: `Keep it under ${MAX_TOTAL_SEC}s` }, { status: 400 })

  // resolve each clip's signed mp4 + captions from its videos row (never trust client URLs)
  const ids = [...new Set(tl.data.map((c) => c.sourceVideoId))]
  const { data: vids } = await service.from('videos')
    .select('id, mp4_url, captions_vtt_url').in('id', ids).eq('workspace_id', workspaceId)
  const byId = new Map((vids ?? []).map((v) => [v.id, v]))
  for (const c of tl.data) {
    const v = byId.get(c.sourceVideoId)
    if (!v?.mp4_url) return NextResponse.json({ error: 'A clip is missing or not ready yet' }, { status: 400 })
  }

  const { data: edit, error: eErr } = await service.from('video_edits').insert({
    workspace_id: workspaceId, coach_id: user.id, project_id: projectId,
    caption_style: project.caption_style, status: 'rendering',
  }).select('id').single()
  if (eErr || !edit) { await logServerError('POST /api/studio/render insert', eErr); return NextResponse.json({ error: 'Could not start the render' }, { status: 500 }) }
  const editId = edit.id

  await service.from('video_projects').update({ status: 'rendering', last_render_edit_id: editId, updated_at: new Date().toISOString() }).eq('id', projectId).eq('workspace_id', workspaceId)

  after(async () => {
    try {
      // build clips + merged timeline-time captions
      let cursorSec = 0
      const renderClips: TimelineRenderInput['clips'] = []
      let captions: TimelineRenderInput['captions'] = []
      for (const c of tl.data) {
        const v = byId.get(c.sourceVideoId)!
        renderClips.push({ mp4Url: signBunnyUrl(v.mp4_url!), inSec: c.inSec, outSec: c.outSec, crop: c.crop, captionsOn: c.captionsOn })
        if (c.captionsOn && project.caption_style !== 'none' && v.captions_vtt_url) {
          const { cues } = await fetchBunnyCaptions(signBunnyUrl(v.captions_vtt_url))
          captions = captions.concat(offsetCues(cues, { inSec: c.inSec, outSec: c.outSec, startSec: cursorSec }))
        }
        cursorSec += Math.max(0, c.outSec - c.inSec)
      }
      const { renderId, bucketName } = await startTimelineRender({ clips: renderClips, captions, captionStyle: project.caption_style as TimelineRenderInput['captionStyle'] })
      await service.from('video_edits').update({ remotion_render_id: renderId, remotion_bucket: bucketName }).eq('id', editId)
    } catch (err) {
      await logServerError('studio render kickoff', err)
      await service.from('video_edits').update({ status: 'failed', error: 'Could not start the render — try again' }).eq('id', editId)
      await service.from('video_projects').update({ status: 'failed' }).eq('id', projectId)
    }
  })

  return NextResponse.json({ data: { editId } })
}
```

- [ ] **Step 3: Verify with tsc + unauth probe**

Run: `npx tsc --noEmit` → Expected: clean.
Start dev, then: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/studio/render` → Expected: `401` (requireCoach blocks; route module loaded).

- [ ] **Step 4: Commit**

```bash
git add lib/remotion.ts app/api/studio/render/route.ts
git commit -m "feat(studio): project-mode render route + startTimelineRender"
```

---

## Task 6: Projects CRUD API

**Files:**
- Create: `app/api/studio/projects/route.ts` (GET list, POST create)
- Create: `app/api/studio/projects/[id]/route.ts` (GET, PATCH, DELETE)

- [ ] **Step 1: Implement `app/api/studio/projects/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { TimelineSchema, ProjectAudioSchema, CAPTION_STYLES } from '@/lib/studio/timeline'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth
  const { data, error } = await supabase.from('video_projects')
    .select('id, title, caption_style, timeline, status, updated_at, last_render_edit_id')
    .eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load projects' }, { status: 500 })
  return NextResponse.json({ data })
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).default('Untitled'),
  timeline: TimelineSchema.default([]),
  audio: ProjectAudioSchema.optional(),
  captionStyle: z.enum(CAPTION_STYLES).default('tiktok'),
})

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { title, timeline, audio, captionStyle } = parsed.data
  const service = createServiceClient()
  const { data, error } = await service.from('video_projects').insert({
    workspace_id: workspaceId, coach_id: user.id, title,
    timeline, audio: audio ?? {}, caption_style: captionStyle,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Could not create project' }, { status: 500 })
  return NextResponse.json({ data: { id: data.id } }, { status: 201 })
}
```

- [ ] **Step 2: Implement `app/api/studio/projects/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { TimelineSchema, ProjectAudioSchema, CAPTION_STYLES } from '@/lib/studio/timeline'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth
  const { id } = await params
  const { data, error } = await supabase.from('video_projects')
    .select('id, title, caption_style, timeline, audio, status, updated_at, last_render_edit_id')
    .eq('id', id).eq('workspace_id', workspaceId).single()
  if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ data })
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  timeline: TimelineSchema.optional(),
  audio: ProjectAudioSchema.optional(),
  captionStyle: z.enum(CAPTION_STYLES).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.timeline !== undefined) patch.timeline = parsed.data.timeline
  if (parsed.data.audio !== undefined) patch.audio = parsed.data.audio
  if (parsed.data.captionStyle !== undefined) patch.caption_style = parsed.data.captionStyle
  const service = createServiceClient()
  const { error } = await service.from('video_projects').update(patch).eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: 'Could not save project' }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('video_projects').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: 'Could not delete project' }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; with dev running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/studio/projects` → `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/studio/projects/route.ts app/api/studio/projects/[id]/route.ts
git commit -m "feat(studio): video_projects CRUD API"
```

---

## Task 7: Studio nav (icon + sidebar + more-sheet)

**Files:**
- Modify: `components/icons/inked.tsx`, `app/coach/CoachSidebarShell.tsx`, `app/coach/CoachMoreSheet.tsx`

- [ ] **Step 1: Add the `studio` inked icon** — extend BOTH the union and `PATHS` in `components/icons/inked.tsx` (a missing `PATHS` entry is a build-breaking type error)

```tsx
// add to the InkedIconName union:
  | 'studio'
// add to the PATHS record (a clapperboard glyph on the 0 0 24 24 viewBox):
  studio: (<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M3 7l3-3 3 3M9 7l3-3 3 3M15 7l3-3 3 3" /></>),
```

- [ ] **Step 2: Add Studio to the desktop sidebar** "Grow" section in `app/coach/CoachSidebarShell.tsx` (place it first in Grow, above Promote)

```tsx
{ title: 'Grow', items: [
  { href: '/coach/studio', label: 'Studio', icon: <Icon name="studio" /> },
  { href: '/coach/promote', label: 'Promote', icon: <Icon name="promote" /> },
  { href: '/coach/leads', label: 'Lead Research', icon: <Icon name="leads" />, pill: 'PRO' },
  { href: '/coach/videos', label: 'Videos', icon: <Icon name="videos" /> },
] },
```

- [ ] **Step 3: Add Studio to the mobile "More" sheet** "Grow" group in `app/coach/CoachMoreSheet.tsx`

```tsx
{ title: 'Grow', rows: [
  { href: '/coach/studio', label: 'Studio', icon: 'studio' },
  { href: '/coach/promote', label: 'Promote', icon: 'promote' },
  { href: '/coach/leads', label: 'Lead Research', icon: 'leads' },
  { href: '/coach/videos', label: 'Videos', icon: 'videos' },
] },
```

- [ ] **Step 4: Verify** — stop dev, `npm run build` → Expected: clean (proves the icon union/record + nav typecheck). Restart dev; load `/coach/dashboard`; confirm "Studio" appears in the sidebar (desktop) and in More (mobile, 375px).

- [ ] **Step 5: Commit**

```bash
git add components/icons/inked.tsx app/coach/CoachSidebarShell.tsx app/coach/CoachMoreSheet.tsx
git commit -m "feat(studio): add Studio to coach nav (sidebar + more sheet + inked icon)"
```

---

## Task 8: Studio shell + Projects page

**Files:**
- Create: `app/coach/studio/page.tsx`, `app/coach/studio/projects/page.tsx`, `app/coach/studio/projects/ProjectsContent.tsx`

- [ ] **Step 1: `app/coach/studio/page.tsx`** — redirect to Projects

```tsx
import { redirect } from 'next/navigation'
export default function StudioIndex() { redirect('/coach/studio/projects') }
```

- [ ] **Step 2: `app/coach/studio/projects/page.tsx`** — server shell using the existing PageHeader pattern

```tsx
import { PageHeader } from '@/components/layout/PageHeader'
import { ProjectsContent } from './ProjectsContent'
export const dynamic = 'force-dynamic'
export default function ProjectsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader title="Studio" subtitle="Edit clips into posts" icon="studio" />
      <ProjectsContent />
    </div>
  )
}
```

- [ ] **Step 3: `app/coach/studio/projects/ProjectsContent.tsx`** — client list (fetch GET, new/open/delete). Use existing `Card` + `EmptyState` primitives.

```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

type Project = { id: string; title: string; status: string; updated_at: string }

export function ProjectsContent() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/studio/projects', { credentials: 'include' })
    const j = await res.json()
    if (!res.ok) { setErr(j.error ?? 'Could not load'); return }
    setProjects(j.data ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  async function createNew() {
    const res = await fetch('/api/studio/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ title: 'Untitled' }) })
    const j = await res.json()
    if (res.ok) router.push(`/coach/studio/edit?project=${j.data.id}`)
    else setErr(j.error ?? 'Could not create')
  }
  async function remove(id: string) {
    await fetch(`/api/studio/projects/${id}`, { method: 'DELETE', credentials: 'include' })
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={createNew} className="btn-primary-gloss rounded-xl px-4 py-2 font-medium">New project</button>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {projects && projects.length === 0 && (
        <EmptyState title="No projects yet" body="Start a new project to stitch clips into a post." />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(projects ?? []).map((p) => (
          <Card key={p.id} className="flex items-center justify-between p-4">
            <button className="text-left" onClick={() => router.push(`/coach/studio/edit?project=${p.id}`)}>
              <div className="font-medium">{p.title}</div>
              <div className="text-xs opacity-60">{p.status} · {new Date(p.updated_at).toLocaleDateString()}</div>
            </button>
            <button onClick={() => remove(p.id)} className="text-xs opacity-60 hover:opacity-100">Delete</button>
          </Card>
        ))}
      </div>
    </div>
  )
}
```
*(If `Card`/`EmptyState`/`PageHeader` prop names differ, match the real signatures from `components/ui/` + `components/layout/` — they exist per the redesign.)*

- [ ] **Step 4: Verify** — `npm run build` clean; browser: `/coach/studio` redirects to Projects, "New project" creates a row and navigates to the editor route (will 404 the editor until Task 9 — expected).

- [ ] **Step 5: Commit**

```bash
git add app/coach/studio/page.tsx app/coach/studio/projects
git commit -m "feat(studio): Studio shell + Projects list page"
```

---

## Task 9: The timeline editor (`StudioEditor`)

**Files:**
- Create: `app/coach/studio/edit/page.tsx`, `app/coach/studio/StudioEditor.tsx`

This is the core UI. Verified by `next build` + browser smoke (not unit tests). The tricky logic (split / reorder / trim) is given in full; the JSX is described with the exact elements.

- [ ] **Step 1: `app/coach/studio/edit/page.tsx`** (reads `?project=` and renders the client editor)

```tsx
import { StudioEditor } from '../StudioEditor'
export const dynamic = 'force-dynamic'
export default async function EditPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams
  if (!project) { const { redirect } = await import('next/navigation'); redirect('/coach/studio/projects') }
  return <StudioEditor projectId={project!} />
}
```

- [ ] **Step 2: `app/coach/studio/StudioEditor.tsx`** — full state model + handlers

State + types (full):
```tsx
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RenderPanel } from './RenderPanel'
import { totalDurationSec, MAX_CLIPS, type CaptionStyle } from '@/lib/studio/timeline'

type LibVideo = { id: string; title: string; thumbnail_url: string | null; mp4_url: string | null; duration_seconds: number | null; embed_url?: string | null }
type EditorClip = { uid: string; sourceVideoId: string; title: string; thumb: string | null; sourceDur: number; inSec: number; outSec: number; captionsOn: boolean }

let _uid = 0
const nextUid = () => `c${++_uid}`

export function StudioEditor({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('Untitled')
  const [clips, setClips] = useState<EditorClip[]>([])
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('tiktok')
  const [selected, setSelected] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibVideo[]>([])
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef<string>('')
```

Load project + library:
```tsx
  useEffect(() => {
    void (async () => {
      const [pRes, vRes] = await Promise.all([
        fetch(`/api/studio/projects/${projectId}`, { credentials: 'include' }),
        fetch('/api/videos?status=ready', { credentials: 'include' }),
      ])
      const p = (await pRes.json()).data
      const vids: LibVideo[] = (await vRes.json()).data ?? []
      setLibrary(vids.filter((v) => v.mp4_url))
      if (p) {
        setTitle(p.title); setCaptionStyle(p.caption_style)
        const byId = new Map(vids.map((v) => [v.id, v]))
        setClips((p.timeline ?? []).map((c: { sourceVideoId: string; inSec: number; outSec: number; captionsOn?: boolean }) => {
          const v = byId.get(c.sourceVideoId)
          return { uid: nextUid(), sourceVideoId: c.sourceVideoId, title: v?.title ?? 'Clip', thumb: v?.thumbnail_url ?? null, sourceDur: v?.duration_seconds ?? c.outSec, inSec: c.inSec, outSec: c.outSec, captionsOn: c.captionsOn ?? true }
        }))
      }
    })()
  }, [projectId])
```

Mutators (full — split/reorder/trim are the load-bearing logic):
```tsx
  const addClip = (v: LibVideo) => {
    if (clips.length >= MAX_CLIPS) return
    setClips((cs) => [...cs, { uid: nextUid(), sourceVideoId: v.id, title: v.title, thumb: v.thumbnail_url, sourceDur: v.duration_seconds ?? 10, inSec: 0, outSec: v.duration_seconds ?? 10, captionsOn: true }])
    setPicking(false)
  }
  const removeClip = (uid: string) => setClips((cs) => cs.filter((c) => c.uid !== uid))
  const move = (uid: string, dir: -1 | 1) => setClips((cs) => {
    const i = cs.findIndex((c) => c.uid === uid); const j = i + dir
    if (i < 0 || j < 0 || j >= cs.length) return cs
    const copy = [...cs];[copy[i], copy[j]] = [copy[j], copy[i]]; return copy
  })
  const trim = (uid: string, inSec: number, outSec: number) => setClips((cs) => cs.map((c) => c.uid === uid ? { ...c, inSec: Math.max(0, Math.min(inSec, c.sourceDur - 0.5)), outSec: Math.min(c.sourceDur, Math.max(outSec, inSec + 0.5)) } : c))
  const toggleCaptions = (uid: string) => setClips((cs) => cs.map((c) => c.uid === uid ? { ...c, captionsOn: !c.captionsOn } : c))
  // SPLIT: cut the selected clip at a point (sec, relative to source) into two adjacent segments
  const split = (uid: string, atSec: number) => setClips((cs) => {
    const i = cs.findIndex((c) => c.uid === uid); if (i < 0) return cs
    const c = cs[i]
    if (atSec <= c.inSec + 0.25 || atSec >= c.outSec - 0.25) return cs // too close to an edge
    const left = { ...c, uid: nextUid(), outSec: atSec }
    const right = { ...c, uid: nextUid(), inSec: atSec }
    return [...cs.slice(0, i), left, right, ...cs.slice(i + 1)]
  })
```

Persist (debounced save → PATCH; serialize EditorClip → timeline JSON):
```tsx
  const serialize = useCallback(() => clips.map((c) => ({ sourceVideoId: c.sourceVideoId, inSec: Number(c.inSec.toFixed(2)), outSec: Number(c.outSec.toFixed(2)), crop: null, captionsOn: c.captionsOn })), [clips])
  const save = useCallback(async () => {
    const body = JSON.stringify({ title, timeline: serialize(), captionStyle })
    if (body === savedRef.current) return
    setSaving(true)
    const res = await fetch(`/api/studio/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body })
    if (res.ok) savedRef.current = body
    setSaving(false)
  }, [title, serialize, captionStyle, projectId])
  useEffect(() => { const t = setTimeout(() => { void save() }, 1200); return () => clearTimeout(t) }, [save])
```

JSX layout (responsive: stacked on phone, `lg:grid-cols-[1fr_320px]` on desktop). Render, in order:
1. **Header row:** an editable `<input>` bound to `title`; a "saving…/saved" hint; a **Render** action that lives in `<RenderPanel projectId={projectId} canRender={clips.length>0} totalSec={totalDurationSec(serialize())} onBeforeRender={save} title={title} />`.
2. **Preview/clip area** (left/top): if a clip is `selected`, show its source in a 9:16 `<iframe src={library.find(...)?.embed_url}>` (Bunny embed) or its thumbnail; else a placeholder. (Phase 2 swaps this for a composite player.)
3. **Timeline strip:** horizontal scroll row of clip cards (thumbnail, trimmed length `=(outSec-inSec).toFixed(1)+'s'`, up/down `move` arrows, `×` remove, click → `setSelected`). At the end, a **`+ Add clip`** button → `setPicking(true)`. Show `totalDurationSec(serialize())` and a soft warning when `>60`.
4. **Inspector** (right/bottom, for the `selected` clip): two range sliders (`inSec`,`outSec` over `[0, sourceDur]`, step 0.1) wired to `trim`; a **Split at midpoint** button calling `split(uid, (inSec+outSec)/2)` (Phase 2 = split at playhead); a **Captions on/off** toggle calling `toggleCaptions`.
5. **Caption-style picker:** 3 buttons — `tiktok` (label **"Bold"**), `minimal` (label **"Minimal"**), `none` (label **"Off"**) — set `captionStyle`. *(Karaoke is added in Phase 3; for now "Bold" maps to the `tiktok` render style.)*
6. **Clip picker drawer** (when `picking`): grid of `library` items (thumbnail + title), click → `addClip`. Greys out when `clips.length >= MAX_CLIPS`.

Reuse Tailwind tokens already in the app (`btn-primary-gloss`, `card-gloss`, `--accent`). Range-slider markup mirrors `app/coach/promote/VideoEditor.tsx`.

- [ ] **Step 3: Verify (build + browser smoke)**

Run: `npm run build` → Expected: clean.
Browser (demo coach): open a project → add 2 clips → reorder with arrows → select a clip → trim both ends → Split at midpoint (clip becomes two) → toggle a clip's captions → switch caption style → reload the page and confirm the timeline persisted (proves debounced PATCH worked).

- [ ] **Step 4: Commit**

```bash
git add app/coach/studio/edit app/coach/studio/StudioEditor.tsx
git commit -m "feat(studio): timeline editor — clip picker, trim, split, reorder, autosave"
```

---

## Task 10: Render + deliver panel

**Files:**
- Create: `app/coach/studio/RenderPanel.tsx`

- [ ] **Step 1: Implement `RenderPanel.tsx`** (POST `/api/studio/render`, reuse the exact polling pattern from `VideoEditor.tsx`)

```tsx
'use client'
import { useRef, useState } from 'react'

type RS = 'idle' | 'rendering' | 'done' | 'failed'

export function RenderPanel({ projectId, canRender, totalSec, onBeforeRender, title }: {
  projectId: string; canRender: boolean; totalSec: number; onBeforeRender: () => Promise<void>; title: string
}) {
  const [state, setState] = useState<RS>('idle')
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [savedToLib, setSavedToLib] = useState(false)
  const cancelled = useRef(false)

  async function poll(id: string) {
    for (let i = 0; i < 200 && !cancelled.current; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const res = await fetch(`/api/studio/render/status?editId=${encodeURIComponent(id)}`, { credentials: 'include' })
      // NOTE: reuse the existing status route — it is editId-based + composition-agnostic.
      const d = (await res.json()).data as { status: RS; progress: number; outputUrl: string | null; error: string | null }
      setProgress(d.progress ?? 0)
      if (d.status === 'done' && d.outputUrl) { setOutputUrl(d.outputUrl); setState('done'); return }
      if (d.status === 'failed') { setErr(d.error ?? 'Render failed'); setState('failed'); return }
    }
  }
  async function render() {
    setErr(null); await onBeforeRender()
    setState('rendering'); setProgress(0); cancelled.current = false
    const res = await fetch('/api/studio/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ projectId }) })
    const j = await res.json()
    if (!res.ok) { setErr(j.error ?? 'Could not start'); setState('failed'); return }
    setEditId(j.data.editId); void poll(j.data.editId)
  }
  async function saveToLibrary() {
    if (!editId) return
    const res = await fetch('/api/studio/save-to-library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ editId, title }) })
    if (res.ok) setSavedToLib(true); else setErr((await res.json()).error ?? 'Could not save')
  }

  return (
    <div className="space-y-2">
      <button onClick={render} disabled={!canRender || state === 'rendering'} className="btn-primary-gloss rounded-xl px-4 py-2 font-medium disabled:opacity-50">
        {state === 'rendering' ? `Rendering ${Math.round(progress * 100)}%` : 'Render'}
      </button>
      {state === 'rendering' && <div className="h-1.5 w-full rounded bg-white/10"><div className="h-full rounded bg-[var(--accent)]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      {err && <p className="text-sm text-red-400">{err}</p>}
      {state === 'done' && outputUrl && (
        <div className="space-y-2">
          <video src={outputUrl} controls className="aspect-[9/16] w-full max-w-[240px] rounded-xl" />
          <div className="flex gap-2">
            <a href={outputUrl} download className="rounded-xl border border-white/15 px-3 py-1.5 text-sm">Download</a>
            <button onClick={saveToLibrary} disabled={savedToLib} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm disabled:opacity-50">{savedToLib ? 'Saved ✓' : 'Save to library'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `npm run build` clean. Full browser render only works once the **Lambda site is redeployed** (Prereq #2) and a real project has ≥1 ready Bunny clip; otherwise expect a 503 (not configured) or a clear failure. Confirm the button disables + progress bar renders.

- [ ] **Step 3: Commit**

```bash
git add app/coach/studio/RenderPanel.tsx
git commit -m "feat(studio): render + deliver panel (progress, download, save-to-library)"
```

---

## Task 11: Save-to-library — re-ingest rendered MP4 to Bunny

**Files:**
- Modify: `lib/bunny.ts` (add `fetchBunnyVideoFromUrl`)
- Create: `app/api/studio/save-to-library/route.ts`

- [ ] **Step 1: Add `fetchBunnyVideoFromUrl` to `lib/bunny.ts`** (create a Bunny video, then tell Bunny to fetch the rendered MP4 by URL — reuses `createBunnyVideo` + the Bunny fetch endpoint)

```ts
// Creates a Bunny video and kicks off a server-side fetch of an existing MP4 URL.
// Returns the new Bunny guid. Bunny transcodes async; poll getBunnyVideo() for readiness.
export async function fetchBunnyVideoFromUrl(title: string, sourceUrl: string): Promise<{ guid: string; libraryId: string }> {
  const { libraryId, apiKey } = cfg() // existing cfg() returns these
  const created = await createBunnyVideo(title)              // POST .../videos → { videoId, libraryId }
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${created.videoId}/fetch`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sourceUrl }),
  })
  if (!res.ok) throw new Error(`Bunny fetch failed: ${res.status}`)
  return { guid: created.videoId, libraryId: String(libraryId) }
}
```
*(If `cfg()` doesn't expose `apiKey`/`libraryId`, read them the same way `createBunnyVideo` does — match that function's access pattern exactly.)*

- [ ] **Step 2: Implement `app/api/studio/save-to-library/route.ts`** (takes a done `video_edits`, ingests its `output_url`, inserts a `videos` row mirroring `bunny/create`)

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchBunnyVideoFromUrl } from '@/lib/bunny'
import { logServerError } from '@/lib/log-server-error'

export const runtime = 'nodejs'
const schema = z.object({ editId: z.string().uuid(), title: z.string().trim().min(1).max(120).default('My Reel') })

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { editId, title } = parsed.data
  const service = createServiceClient()

  const { data: edit } = await service.from('video_edits')
    .select('id, output_url, status').eq('id', editId).eq('workspace_id', workspaceId).single()
  if (!edit?.output_url || edit.status !== 'done') return NextResponse.json({ error: 'Render not ready' }, { status: 400 })

  try {
    const { guid, libraryId } = await fetchBunnyVideoFromUrl(title, edit.output_url)
    const { data: row, error } = await service.from('videos').insert({
      workspace_id: workspaceId, coach_id: user.id, title,
      storage_provider: 'bunny', bunny_library_id: libraryId, bunny_video_guid: guid,
      processing_status: 'processing',
    }).select('id').single()
    if (error || !row) throw error ?? new Error('insert failed')
    // record the bunny guid back on the edit (the output_guid column already exists)
    await service.from('video_edits').update({ output_guid: guid }).eq('id', editId)
    return NextResponse.json({ data: { videoId: row.id } }, { status: 201 })
  } catch (err) {
    await logServerError('POST /api/studio/save-to-library', err)
    return NextResponse.json({ error: 'Could not save to library' }, { status: 500 })
  }
}
```
*(The new `videos` row finishes processing via the same Bunny transcode the library already polls; URLs populate when Bunny is done. If the library needs a status nudge, reuse the `bunny/status` poller path.)*

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/studio/save-to-library` → `401`. `npm run build` clean.

- [ ] **Step 4: Commit**

```bash
git add lib/bunny.ts app/api/studio/save-to-library/route.ts
git commit -m "feat(studio): save rendered reel back to the library (Bunny re-ingest)"
```

---

## Task 12: Cleanup + full smoke

- [ ] **Step 1: Delete the throwaway TDD harness**

```bash
git rm scripts/_studio-check.ts
git commit -m "chore(studio): remove throwaway test harness"
```

- [ ] **Step 2: Full local smoke** (demo coach, dev running, migration applied, Lambda site redeployed): new project → add 2 clips → trim/split/reorder → Render → progress → download plays → Save to library → appears in `/coach/videos` after Bunny finishes. Note any failures for follow-up.

- [ ] **Step 3: Final build gate** — stop dev, `npm run build` → Expected: clean (all routes compile).

---

## Self-review (against the spec, Phase 1 scope)

- **Multi-clip stitch** → Tasks 4 (`TimelineVideo` `<Series>`) + 9 (add/reorder). ✓
- **Per-clip trim** → Task 9 `trim()` + sliders. ✓
- **Split** → Task 9 `split()`. ✓
- **Auto vertical fill (kill letterbox)** → Task 3 `coverStyle` + Task 4 default center-cover. ✓
- **Captions (bold/minimal), per-clip toggle** → Task 4 `CaptionLayer` + Task 5 cue merge + Task 9 picker/toggle. (Karaoke deferred to Phase 3 — `tiktok` label "Bold".) ✓
- **Render via existing Lambda** → Task 5 `startTimelineRender` + reused status route. ✓
- **Save to library + rename + download** → Tasks 10 (download + rename via title) + 11 (Bunny re-ingest). ✓
- **Studio IA (Edit/Projects)** → Tasks 7–9. (Scheduled tab is Phase 3.) ✓
- **video_projects + additive video_edits.project_id + RLS** → Task 1. ✓
- **Guardrails reused (rate-limit, spend-guard, idempotency)** → Task 5. ✓
- **Type consistency:** `CaptionStyle` union (`tiktok|minimal|karaoke|none`) is shared from `lib/studio/timeline.ts`; render-side `TimelineRenderInput.captionStyle` matches; `Caption` shape `{startMs,endMs,text}` from `lib/bunny.ts` flows through `offsetCues` into `TimelineCaption`. ✓
- **Known Phase-1 simplifications (intended):** no manual crop UI (center-cover only), no audio, preview is per-clip iframe not composite, karaoke renders as bold. All are explicit Phase 2/3 items in the spec.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-05-coach-studio-phase1-editor-core.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
