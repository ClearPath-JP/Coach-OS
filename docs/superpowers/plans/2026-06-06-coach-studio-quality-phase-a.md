# Coach Studio — Quality (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rendered reels sharp (not pixelated) and stop hard-cropping landscape clips ("squished"), shipping on the *current* editor with no DB migration.

**Architecture:** Three independent fixes from `docs/superpowers/specs/2026-06-06-coach-studio-quality-and-editing-redesign-design.md` §3: (1) feed Lambda the **highest-res** Bunny MP4 instead of a hardcoded 720p; (2) render frames **losslessly** (drop the JPEG intermediate); (3) add a per-clip **`fillMode`** (default `color` = whole clip on black) so landscape clips stop getting chopped. The editor rewrite (Phase B) and true drag-crop come later.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Remotion (AWS Lambda), Bunny Stream.

---

## Testing conventions for THIS codebase (read first)

The repo's `jest` suite is **integration-only** (numbered `__tests__/0N-*.test.ts`, shared state, hits a live server) — **do not add unit tests there.** Per the spec §8 and project convention:
- **Pure logic** → write a throwaway `npx tsx scripts/_check-*.ts` with real assertions, run it (watch it fail, then pass), then **delete it** (don't commit the throwaway).
- **Everything else** (Remotion composition, API routes, React UI) → gate with `npx tsc --noEmit`, a full `npm run build`, and a real browser/render check.
- **Build gate (Windows):** `next dev` and `next build` fight over `.next` — **stop the dev server** (kill the PID on :3000) before `npm run build`, restart after. Run dev with `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` set to a space to avoid local Upstash latency.
- Per-task quick gate = `npx tsc --noEmit` (safe while dev runs).
- Commit after each task. Branch: `rebuild/v2` (the active branch; no worktree).

---

## Task 0 — Owner prerequisite (no code): enable 1080p MP4 fallback in Bunny

**This gates the entire resolution win.** `getBunnyVideo` builds `play_<res>.mp4` from Bunny's `availableResolutions`. If the Stream library's **MP4 Fallback** only outputs up to 720p, picking "highest available" still yields 720p.

- [ ] **Step 1: Verify/enable in the Bunny dashboard**
  - Bunny → Stream → library **"Kindo Coach Videos"** (id `672196`) → **Encoding / MP4 Fallback** → ensure resolutions include **1080p** (and that "MP4 Fallback" is enabled). Source clips must be ≥1080p to get a 1080p rendition.
  - Re-upload (or re-encode) at least one ≥1080p test clip so a `play_1080p.mp4` exists for end-to-end verification in Task 7.
  - No code; record "done" here. The code in Task 1 picks the best of whatever Bunny produces.

---

## Task 1 — Feed Lambda the highest-res Bunny MP4 (kills the 720p cap)

**Files:**
- Create: `lib/bunny-resolution.ts`
- Modify: `lib/bunny.ts:168-179` (the `mp4Res` selection inside `getBunnyVideo`)
- Throwaway test: `scripts/_check-bunny-res.ts`

> `lib/bunny.ts` starts with `import 'server-only'`, which throws under plain `tsx`. So the pure picker lives in its own file (no `server-only`) and is imported by `bunny.ts` — that keeps it unit-testable.

- [ ] **Step 1: Write the failing check**

```ts
// scripts/_check-bunny-res.ts
import { pickBestMp4Resolution } from '../lib/bunny-resolution'

function eq(label: string, got: string, want: string) {
  if (got !== want) { console.error(`FAIL ${label}: got ${got}, want ${want}`); process.exit(1) }
  console.log(`ok ${label}`)
}
eq('prefers 1080 over 720', pickBestMp4Resolution(['720p', '480p', '1080p']), '1080p')
eq('keeps 4k', pickBestMp4Resolution(['2160p', '1080p', '720p']), '2160p')
eq('falls back when empty', pickBestMp4Resolution([]), '720p')
eq('ignores junk', pickBestMp4Resolution(['', 'weird', '360p']), '360p')
console.log('ALL PASS')
```

- [ ] **Step 2: Run it, watch it fail**

Run: `npx tsx scripts/_check-bunny-res.ts`
Expected: FAIL — `Cannot find module '../lib/bunny-resolution'`.

- [ ] **Step 3: Implement the picker**

```ts
// lib/bunny-resolution.ts
// Pure helper (no 'server-only') so it's unit-testable under tsx.
// Picks the sharpest MP4 fallback rendition Bunny produced. Bunny's
// `availableResolutions` is a comma list like "240p,360p,480p,720p,1080p".
const RES_RANK: Record<string, number> = {
  '2160p': 2160, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360, '240p': 240,
}

export function pickBestMp4Resolution(available: string[]): string {
  const ranked = available
    .map((r) => r.trim())
    .filter((r) => r in RES_RANK)
    .sort((a, b) => (RES_RANK[b] ?? 0) - (RES_RANK[a] ?? 0))
  return ranked[0] ?? '720p'
}
```

- [ ] **Step 4: Run the check, watch it pass**

Run: `npx tsx scripts/_check-bunny-res.ts`
Expected: `ALL PASS`.

- [ ] **Step 5: Wire it into `getBunnyVideo`**

In `lib/bunny.ts`, add the import near the top (after the existing imports):

```ts
import { pickBestMp4Resolution } from './bunny-resolution'
```

Replace the resolution-selection line (currently `const mp4Res = resolutions.includes('720p') ? '720p' : (resolutions[resolutions.length - 1] ?? '720p')`) with:

```ts
const mp4Res = pickBestMp4Resolution(resolutions)
```

- [ ] **Step 6: Typecheck, delete the throwaway, commit**

```bash
npx tsc --noEmit
rm scripts/_check-bunny-res.ts
git add lib/bunny-resolution.ts lib/bunny.ts
git commit -m "fix(studio): use highest-res Bunny MP4 (was hardcoded to 720p)"
```
Expected: `tsc` exits 0.

---

## Task 2 — Render losslessly (drop the JPEG frame intermediate)

**Files:**
- Modify: `lib/remotion.ts` (both `startCaptionedRender` and `startTimelineRender`)

> Isolated, tsc-clean change. The `fillMode` field on the render *input* type is added in Task 5 together with its only consumer (the route), so no commit is left broken.

- [ ] **Step 1: Switch frame format to PNG in both render functions**

In `lib/remotion.ts`, inside **both** `renderMediaOnLambda({ ... })` calls, change:

```ts
    imageFormat: 'jpeg',
```
to:
```ts
    imageFormat: 'png',     // lossless frames — JPEG (q80) was double-compressing every frame
```
Leave `codec: 'h264'` and `framesPerLambda: 1000` as-is. (If Task 7's benchmark shows PNG is too slow on the 10-concurrency Lambda, the documented fallback is `imageFormat: 'jpeg'` + `jpegQuality: 100` — note it in the commit if used.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 (isolated change).

- [ ] **Step 3: Commit**

```bash
git add lib/remotion.ts
git commit -m "perf(studio): render lossless PNG frames (was double-compressing via JPEG)"
```

---

## Task 3 — Add `fillMode` to the timeline schema + a resolver

**Files:**
- Modify: `lib/studio/timeline.ts`
- Throwaway test: `scripts/_check-fillmode.ts`

- [ ] **Step 1: Write the failing check**

```ts
// scripts/_check-fillmode.ts
import { effectiveFillMode } from '../lib/studio/timeline'

function eq(label: string, got: string, want: string) {
  if (got !== want) { console.error(`FAIL ${label}: got ${got}, want ${want}`); process.exit(1) }
  console.log(`ok ${label}`)
}
const crop = { x: 0.1, y: 0, w: 0.5, h: 1 }
eq('default is color', effectiveFillMode({}), 'color')
eq('explicit wins', effectiveFillMode({ fillMode: 'blur' }), 'blur')
eq('legacy crop → crop', effectiveFillMode({ crop }), 'crop')
eq('explicit beats legacy crop', effectiveFillMode({ fillMode: 'color', crop }), 'color')
console.log('ALL PASS')
```

- [ ] **Step 2: Run it, watch it fail**

Run: `npx tsx scripts/_check-fillmode.ts`
Expected: FAIL — `effectiveFillMode` is not exported.

- [ ] **Step 3: Implement the schema + resolver**

In `lib/studio/timeline.ts`, after the `Crop` type (around line 13) add:

```ts
export const FILL_MODES = ['color', 'blur', 'crop'] as const
export type FillMode = (typeof FILL_MODES)[number]
export const FillModeSchema = z.enum(FILL_MODES)
```

In `TimelineClipSchema`, add the field (keep the existing `.refine(...)`):

```ts
export const TimelineClipSchema = z.object({
  sourceVideoId: z.string().uuid(),
  inSec: z.number().min(0).default(0),
  outSec: z.number().positive(),
  crop: CropSchema.nullable().default(null),
  fillMode: FillModeSchema.optional(),
  captionsOn: z.boolean().default(true),
}).refine((c) => c.outSec > c.inSec, { message: 'Clip end must be after its start' })
```

At the end of the file add the resolver (back-compat: legacy clips with a crop but no `fillMode` keep their crop intent):

```ts
export function effectiveFillMode(c: { fillMode?: FillMode | null; crop?: Crop | null }): FillMode {
  if (c.fillMode) return c.fillMode
  return c.crop ? 'crop' : 'color'
}
```

- [ ] **Step 4: Run the check, watch it pass**

Run: `npx tsx scripts/_check-fillmode.ts`
Expected: `ALL PASS`.

- [ ] **Step 5: Typecheck, delete throwaway, commit**

```bash
npx tsc --noEmit
rm scripts/_check-fillmode.ts
git add lib/studio/timeline.ts
git commit -m "feat(studio): add per-clip fillMode (default color) + resolver"
```
Expected: `tsc` exits 0 (the schema change is additive/optional).

---

## Task 4 — Implement the three fill modes in the composition

**Files:**
- Modify: `remotion/TimelineVideo.tsx`

Replace the hard-crop behavior with: **color** (whole clip on black), **blur** (blurred cover behind a contained clip), **crop** (plain cover — the *correct* drag-crop math lands in Phase B; plain cover removes today's over-zoom bug).

- [ ] **Step 1: Add `fillMode` to the clip type**

In `remotion/TimelineVideo.tsx`, update `TimelineRenderClip`:

```ts
export type TimelineRenderClip = {
  mp4Url: string
  inSec: number
  outSec: number
  crop: { x: number; y: number; w: number; h: number } | null
  captionsOn: boolean
  fillMode?: 'color' | 'blur' | 'crop'
}
```

- [ ] **Step 2: Replace `coverStyle` with a `ClipLayer` component**

Delete the `coverStyle` function (lines ~24-30) and add this component above `TimelineVideo`:

```tsx
function ClipLayer({ clip, volume }: { clip: TimelineRenderClip; volume: number }) {
  const trimBefore = Math.round(clip.inSec * FPS)
  const trimAfter = Math.round(clip.outSec * FPS)
  const mode = clip.fillMode ?? (clip.crop ? 'crop' : 'color')

  if (mode === 'blur') {
    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(40px) brightness(0.55)', transform: 'scale(1.2)' }} />
        <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </AbsoluteFill>
    )
  }
  if (mode === 'crop') {
    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    )
  }
  // 'color' (default): whole clip centered on black — nothing chopped.
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <OffthreadVideo src={clip.mp4Url} trimBefore={trimBefore} trimAfter={trimAfter} volume={volume}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </AbsoluteFill>
  )
}
```

- [ ] **Step 3: Use `ClipLayer` in the `Series`**

In `TimelineVideo`, replace the inner `<AbsoluteFill><OffthreadVideo .../></AbsoluteFill>` of each `Series.Sequence` with:

```tsx
            <Series.Sequence key={i} durationInFrames={durationInFrames}>
              <ClipLayer clip={clip} volume={vol.clip} />
            </Series.Sequence>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0. (`fillMode` is optional on `TimelineRenderClip`, and the render-input type isn't changed until Task 5, so nothing else breaks.)

- [ ] **Step 5: Commit**

```bash
git add remotion/TimelineVideo.tsx
git commit -m "feat(studio): color/blur/crop fill modes (color-on-black default kills hard-crop)"
```

---

## Task 5 — Render route: highest-res source + pass `fillMode`

**Files:**
- Modify: `lib/remotion.ts` (add `fillMode` to `TimelineRenderInput`)
- Modify: `app/api/studio/render/route.ts`

> This task changes the render-input type **and** its only consumer (the route) together, so the commit stays tsc-clean.

- [ ] **Step 1: Add `fillMode` to the render input clip type**

In `lib/remotion.ts`, in the `TimelineRenderInput` type, add `fillMode` to the `clips` element:

```ts
export type TimelineRenderInput = {
  clips: {
    mp4Url: string
    inSec: number
    outSec: number
    crop: { x: number; y: number; w: number; h: number } | null
    captionsOn: boolean
    fillMode: 'color' | 'blur' | 'crop'
  }[]
  captions: { text: string; startMs: number; endMs: number }[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
  audio?: { musicUrl: string | null; voiceoverUrl: string | null; volumes: { clip: number; music: number; voiceover: number } }
}
```

- [ ] **Step 2: Import the resolver + Bunny lookup in the route**

At the top of `app/api/studio/render/route.ts`, extend the existing imports:
- add `effectiveFillMode` to the `@/lib/studio/timeline` import;
- add `getBunnyVideo` to the `@/lib/bunny` import (currently `import { signBunnyUrl, fetchBunnyCaptions } from '@/lib/bunny'`).

```ts
import { signBunnyUrl, fetchBunnyCaptions, getBunnyVideo } from '@/lib/bunny'
import { TimelineSchema, totalDurationSec, MAX_TOTAL_SEC, ProjectAudioSchema, audioPublicPath, STUDIO_AUDIO_BUCKET, effectiveFillMode } from '@/lib/studio/timeline'
```

- [ ] **Step 3: Select the Bunny guid**

Change the videos select (currently `.select('id, mp4_url, captions_vtt_url')`) to include the guid:

```ts
  const { data: vids } = await service.from('videos')
    .select('id, mp4_url, captions_vtt_url, bunny_video_guid').in('id', ids).eq('workspace_id', workspaceId)
```

- [ ] **Step 4: Re-derive the sharpest MP4 + pass `fillMode` in the `after()` loop**

Replace the `renderClips.push({...})` line inside the `for (const c of tl.data)` loop with:

```ts
        // Stored mp4_url may be an older/lower rendition — re-derive the sharpest
        // available now. Fall back to the stored URL if Bunny lookup fails.
        let bestMp4 = v.mp4_url!
        try {
          if (v.bunny_video_guid) {
            const fresh = await getBunnyVideo(v.bunny_video_guid)
            if (fresh.mp4Url) bestMp4 = fresh.mp4Url
          }
        } catch { /* keep stored mp4_url */ }
        renderClips.push({ mp4Url: signBunnyUrl(bestMp4), inSec: c.inSec, outSec: c.outSec, crop: c.crop, captionsOn: c.captionsOn, fillMode: effectiveFillMode(c) })
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 (the type change + its only consumer landed together).

- [ ] **Step 6: Commit**

```bash
git add lib/remotion.ts app/api/studio/render/route.ts
git commit -m "feat(studio): render uses highest-res Bunny source + per-clip fillMode"
```

---

## Task 6 — Live preview reflects the fill mode (parity)

**Files:**
- Modify: `app/coach/studio/StudioEditor.tsx` (the `previewProps` builder, ~lines 135-149)

So the editor preview shows color-fill (not the old stretch/letterbox) for the same clips. No new UI control in Phase A — the per-clip Blur/Crop picker arrives with the Phase B wizard; default `color` applies automatically.

- [ ] **Step 1: Import the resolver**

In `app/coach/studio/StudioEditor.tsx`, add `effectiveFillMode` to the existing `@/lib/studio/timeline` import.

- [ ] **Step 2: Pass `fillMode` into the preview clips**

In the `previewProps` builder, update the mapped clip object to include `fillMode`:

```ts
      .map((c) => {
        const v = library.find((l) => l.id === c.sourceVideoId)
        return { mp4Url: v?.mp4_url ?? '', inSec: c.inSec, outSec: c.outSec, crop: c.crop, captionsOn: c.captionsOn, fillMode: effectiveFillMode(c) }
      })
```

- [ ] **Step 3: Typecheck + build**

```bash
# stop the dev server first (Windows .next conflict), then:
npx tsc --noEmit
npm run build
```
Expected: both succeed (exit 0). Restart `npm run dev` after.

- [ ] **Step 4: Commit**

```bash
git add app/coach/studio/StudioEditor.tsx
git commit -m "feat(studio): live preview honors fillMode (color-fill default)"
```

---

## Task 7 — Verify the quality jump end-to-end (owner-driven)

**Files:** none (verification only).

- [ ] **Step 1: Confirm the source is now 1080p**

With `BUNNY_STREAM_*` set, for a ready ≥1080p clip's guid, confirm `getBunnyVideo(guid).mp4Url` ends in `play_1080p.mp4` (temporary `npx tsx` log, then delete). If it still says `720p`, Task 0 (Bunny MP4 fallback) isn't enabled — go back.

- [ ] **Step 2: Render a real reel and compare**

In the running app (demo coach `coach@example.com` / `Demo123!`), open Studio, build a project with **one vertical clip and one landscape clip**, render, and download the MP4. Verify:
  - Captions/detail are visibly **sharper** than before (PNG + 1080p source).
  - The **landscape** clip shows **whole, centered on black** (no chopped sides / no over-zoom).
  - The **vertical** clip fills the frame edge-to-edge.

- [ ] **Step 3: Check the live preview matches**

In the editor, confirm the preview shows the same framing (landscape on black, vertical filling). (Captions in the preview are still Phase B.)

- [ ] **Step 4: Final build gate + push**

```bash
# dev server stopped
npm run build
git push origin rebuild/v2
```
Expected: build exits 0. (Deploy to prod via `vercel --prod` is the owner's call, per usual.)

---

## Notes for Phase B (not in scope here)
- True **drag-to-reframe crop** (correct math using the source's real aspect) needs the source `width/height` — capture intrinsic size in the editor and persist it; `'crop'` mode currently renders as plain cover.
- **WYSIWYG captions in the preview** + **filmstrip trim handles** + the **4-step wizard** are Phase B.
- Optional: backfill existing `videos.mp4_url` to the 1080p rendition so the *preview* of old clips also sharpens (the render already re-derives at kickoff via Task 5).
