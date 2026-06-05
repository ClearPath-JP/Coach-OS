# Full Multi-Clip Video Editor — Design Spec (DEFERRED)

**Status:** DESIGN ONLY — not built. For owner review. No code written or changed by this spec.
**Date:** 2026-06-05
**Author:** Claude (COACH-OS dev agent)
**Supersedes/extends:** `docs/VIDEO-EDITOR-PLAN.md` (the single-clip editor that is already live).

> **Read this first:** everything below builds on the stack that is **already paid-for, deployed, and verified in production** — Bunny.net Stream (host + transcode + Whisper captions) and Remotion on AWS Lambda (render). The single-clip editor (`app/coach/promote/VideoEditor.tsx`) already does trim + caption-style + Lambda render. This spec is about turning that into a **multi-clip timeline** without throwing any of it away.

---

## 1. Problem statement & jobs-to-be-done

### Today (verified in code)
- A coach uploads ONE clip in Promote → Video (`app/coach/promote/VideoStep.tsx`), Bunny transcodes + auto-transcribes it, then `VideoEditor.tsx` lets them set a single trim window (start/end) + pick a caption style (`tiktok` / `minimal` / `none`) and render.
- Render = one `video_edits` row → `POST /api/coach/promote/render/route.ts` → `startCaptionedRender()` in `lib/remotion.ts` → Remotion composition `CaptionedClip` (`remotion/CaptionedClip.tsx`) = a **single** `<OffthreadVideo trimBefore trimAfter>` + one caption overlay → MP4 on S3, polled via `/render/status/route.ts`.
- Output frame is **1080×1920 vertical** (`remotion/Root.tsx`). A 16:9 source letterboxes at the top — there is no reframe/crop today (noted as an open item in `VIDEO-EDITOR-PLAN.md`).

### The gap
A real social clip is almost never one raw take. A solo coach filming on a phone wants to stitch a few moments together and post one vertical video.

### Jobs-to-be-done (a solo martial-arts / fitness coach)
1. **"Make one postable Reel from 2–4 of my clips."** Pick a hook clip, a technique clip, and a payoff clip from the library and play them back-to-back.
2. **"Trim each clip to just the good part."** Per-clip in/out, not just one global trim.
3. **"Make it fit vertical without black bars."** A landscape pad-work clip should fill the 9:16 frame (crop/reframe), not letterbox.
4. **"Put my words on screen automatically."** Auto-captions from each clip's existing Bunny transcript, lightly editable, in a chosen style.
5. **"One button → finished vertical MP4 I can download and post"** (and ideally save back into the library / pair with the AI caption Promote already writes).

### Non-goals (keep scope sane — explicitly OUT)
- ❌ Audio mixing, background music tracks, ducking, voiceover recording.
- ❌ Green screen / chroma key, masks, keyframed motion, picture-in-picture overlays.
- ❌ Multi-track **video** layering (overlay video on video). One video track only.
- ❌ Transitions beyond a hard cut + maybe a simple cross-dissolve (and even that is a later phase).
- ❌ Frame-accurate broadcast editing, color grading, speed ramps.
- ❌ Collaborative / multi-editor sessions, versioning, comments.
- ❌ Editing on someone else's footage — this is the coach's own library only.
- ❌ A second render vendor or any new always-on infra. Extend Bunny + Lambda.

This is a **lightweight clip stitcher with captions and vertical reframe**, not Premiere/CapCut.

---

## 2. Architecture options

Three credible paths. Recommendation is **(A) Extend Remotion/Lambda** — it reuses 100% of the deployed, verified pipeline and adds the least new surface area.

### (A) Extend Remotion/Lambda — multi-track composition ✅ RECOMMENDED

**Idea:** Generalize the single `CaptionedClip` composition into a `TimelineVideo` composition that takes a **timeline JSON** (an ordered array of clip segments, each with its own `mp4Url`, trim in/out, crop rect, and caption cues) and lays them out with Remotion's `<Series>` / `<Sequence>`. Render on the same Lambda function that's already deployed.

- **Rendering:** same path as today — `renderMediaOnLambda()` in `lib/remotion.ts`, same function (`remotion-render-4-0-468-...`), same S3 bucket (`kindo-captioned`), same `getRenderProgress()` polling. Only the composition's `inputProps` shape changes (one clip → array of clips). Output stays 1080×1920.
- **Composition:** `remotion/CaptionedClip.tsx` stays for backward-compat; add `remotion/TimelineVideo.tsx`. Each timeline item renders inside a `<Series.Sequence durationInFrames={clipFrames}>` containing an `<OffthreadVideo src trimBefore trimAfter>` plus that clip's caption overlay (reuse the existing overlay logic from `CaptionedClip`). `calculateMetadata` sums each clip's `(out-in)` to compute total `durationInFrames` (same pattern already in `remotion/Root.tsx`).
- **Timeline state lives:** in the browser while editing (React state in a new editor component); persisted to a new `video_projects` row (see §3) so the coach can leave and come back; sent as `inputProps` to Lambda at render time. **The render is fully driven by that JSON — Lambda never sees the editor UI.**
- **Crop/reframe:** handled **in the composition**, not by re-encoding sources. Each clip carries a normalized crop rect `{ x, y, w, h }` (fractions of source). The composition wraps the `OffthreadVideo` in an `<AbsoluteFill>` and applies a CSS `transform: scale()` + `translate()` (or `objectFit: 'cover'` with an offset) so the chosen region fills the 9:16 frame. Default = center-crop to cover (fixes today's letterbox problem for free). This is pure layout math at render time — no extra Bunny processing, no extra cost.
- **Caption sourcing:** **already solved.** Bunny auto-transcribes every upload; `fetchBunnyCaptions(signBunnyUrl(...))` in the render route already pulls VTT cues. For multi-clip we fetch each source clip's cues, **offset each clip's cue timings by that clip's start position on the timeline**, optionally let the coach edit text (Phase 3), and pass the merged cue list per-clip. Reuse `parseVtt` / `fetchBunnyCaptions` in `lib/bunny.ts` as-is.
- **New packages (OWNER MUST APPROVE before any install):**
  - `@remotion/captions` — **optional polish**, for TikTok-style per-word highlighting (already named as the Phase-2 intent in `VIDEO-EDITOR-PLAN.md`). NOT required for Phase 1; the current hand-rolled overlay works.
  - Nothing else strictly required — `remotion`, `@remotion/lambda`, `@remotion/cli` are **already installed and in use**. `<Series>` ships with core `remotion`.
- **Cost:** same per-render economics as today (~$0.01–0.05/short clip on Lambda; Bunny pennies). A 4-clip 45s render costs marginally more Lambda-seconds than a 12s render but is the same order of magnitude. **No new vendor, no new subscription.**
- **Trade-offs:**
  - ✅ Reuses the entire deployed/verified stack; smallest new surface; the timeline JSON is a clean, testable contract.
  - ✅ Crop + captions are "just composition props" — no source re-encoding, no extra Bunny jobs.
  - ✅ Renders are professional/consistent (server-side, deterministic) and not limited by the coach's phone.
  - ⚠️ Lambda concurrency = **10** on this AWS account (see §6) — already mitigated by `framesPerLambda: 1000`; longer multi-clip renders make a quota increase more worthwhile.
  - ⚠️ No real-time scrubbing of the **final** composite in the browser unless we also embed Remotion's `@remotion/player` (a Phase-2/3 nicety, another package to approve). Phase 1 preview can be "play each clip in its Bunny iframe" + a static layout strip.

### (B) Browser-only (ffmpeg.wasm)

**Idea:** Do the cut/concat/crop/caption-burn entirely client-side with `ffmpeg.wasm`, export the MP4 from the browser, never touch Lambda.

- **Rendering:** in the coach's browser tab via WebAssembly.
- **Timeline state:** browser only (could still persist JSON to `video_projects`).
- **Crop/reframe:** ffmpeg `crop`/`scale` filters.
- **Caption sourcing:** same Bunny VTT, but burning captions in ffmpeg means generating a subtitle filter / drawtext per cue — fiddly to style well.
- **New packages (APPROVAL REQUIRED):** `@ffmpeg/ffmpeg`, `@ffmpeg/util` (+ a multi-MB wasm core asset shipped to the client).
- **Cost:** $0 server render cost.
- **Trade-offs:**
  - ✅ No Lambda cost, no concurrency limit, instant local iteration.
  - 🔴 **Concat of clips with different codecs/resolutions/fps requires re-encoding each clip in-browser** — slow and memory-hungry. A multi-clip phone-footage export can take minutes and **crash the tab on mid-range phones** (the ICP is literally "runs everything from their phone").
  - 🔴 We'd be **downloading every source clip from Bunny to the browser** to process — heavy on mobile data, and our sources are token-signed/private.
  - 🔴 Caption styling fidelity is much worse than React/Remotion.
  - 🔴 Throws away the deployed, verified Remotion pipeline.
  - **Verdict:** good for a tiny trim-only tool, wrong for multi-clip on phones. **Reject** as the primary engine.

### (C) Third-party render API (e.g. Shotstack)

**Idea:** Describe the edit as JSON, POST to a hosted render API (Shotstack, Creatomate, etc.), poll, get an MP4.

- **Rendering:** vendor cloud.
- **Timeline state:** their JSON edit schema (we'd map our `video_projects` → their format).
- **Crop/reframe + captions:** supported by their schema.
- **New packages:** usually just an SDK or plain `fetch` (still an integration to build + maintain).
- **Cost:** 🔴 **New recurring/usage bill** (per-minute-rendered pricing, ~$0.20–0.50+/min on typical tiers) on top of Bunny + AWS we already pay. Plus vendor lock-in to their edit schema.
- **Trade-offs:**
  - ✅ Least composition code to write; mature reframe/caption features out of the box.
  - 🔴 **Directly violates the "prefer the already-paid-for stack; ASK before adding a paid service" constraint.** Adds a third media vendor and a new monthly cost for a pre-revenue solo founder.
  - 🔴 We'd still upload/expose sources to a third party.
  - **Verdict:** only revisit if Remotion multi-clip proves too painful or the company outgrows Remotion's free ≤3-person license (`VIDEO-EDITOR-PLAN.md` flags that license boundary). **Reject for now.**

### Recommendation
**Go with (A).** It is the natural extension of code that is already deployed and verified, needs **zero new paid services**, needs **at most one optional new package** (`@remotion/captions`, and only for polish — flag it for approval when we get there), and keeps the render deterministic and phone-independent. Crop and multi-clip both become "just more composition props," which is exactly the kind of focused, reversible change the founder wants.

---

## 3. Data model

> ⚠️ **REQUIRES OWNER SCHEMA APPROVAL — do not apply.** This is a proposed migration shape only. Mirrors the existing `video_edits` RLS pattern (`supabase/migrations/20260528000000_video_editor_bunny_remotion.sql`) which uses workspace-scoped policies via `current_workspace_id()`.

The existing `video_edits` table assumes **one** `source_video_id` + a single `trim_start_sec`/`trim_end_sec`. A multi-clip project can't fit there. Two clean options:

**Option 1 (recommended): a `video_projects` table that stores the whole timeline as JSONB**, and reuse `video_edits` as the **render-job** record (point it at a project instead of a single source video). This keeps "the edit you're authoring" separate from "a render attempt," and renders stay cheap to re-run.

Proposed `video_projects`:

| column | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `workspace_id` | uuid NOT NULL → workspaces ON DELETE CASCADE | RLS scope |
| `coach_id` | uuid NOT NULL → profiles ON DELETE CASCADE | owner |
| `title` | text | e.g. "Armbar Reel" |
| `aspect` | text NOT NULL DEFAULT `'9:16'` | future-proof; only 9:16 in Phase 1 |
| `caption_style` | text NOT NULL DEFAULT `'tiktok'` | project-level default; CHECK in (`tiktok`,`minimal`,`none`) |
| `timeline` | jsonb NOT NULL DEFAULT `'[]'` | ordered clip list — shape below |
| `status` | text NOT NULL DEFAULT `'draft'` | (`draft`,`rendering`,`rendered`,`failed`) |
| `last_render_edit_id` | uuid NULL → video_edits ON DELETE SET NULL | most recent render attempt |
| `created_at` / `updated_at` | timestamptz | `updated_at` via trigger if the codebase has that pattern |

`timeline` JSONB element (validated app-side with Zod, not in the DB — matches how `/render` already uses Zod):
```jsonc
{
  "sourceVideoId": "uuid",     // FK-by-value into videos (the coach's clip)
  "mp4Url": "https://...",     // resolved server-side at render; not trusted from client
  "inSec": 2.0,                // per-clip trim in
  "outSec": 7.5,               // per-clip trim out
  "crop": { "x": 0.1, "y": 0, "w": 0.5625, "h": 1 }, // normalized cover-crop rect (optional; default center-cover)
  "captionsOn": true           // per-clip caption toggle
}
```
Caption **cues** are NOT stored in the project — they're re-fetched from each source clip's Bunny VTT at render time (`fetchBunnyCaptions`), exactly like today, so transcripts stay the source of truth. (If/when Phase 3 adds caption *text editing*, store the edited cues per clip inside the timeline element.)

Changes to **`video_edits`** (additive, also needs approval):
- Add `project_id uuid NULL → video_projects ON DELETE CASCADE`. Keep `source_video_id` nullable for back-compat with single-clip renders. A render row points at *either* a single source video (legacy) *or* a project.
- The existing `trim_start_sec`/`trim_end_sec`/`source_mp4_url` columns simply go unused for project renders (or we snapshot the timeline JSON into a new `video_edits.timeline jsonb` for an exact record of what was rendered).

**Option 2 (lighter, no new table):** add `video_edits.timeline jsonb` and treat a multi-clip render as a single `video_edits` row with `source_video_id = NULL`. Cheapest migration, but you lose a persistent "draft project" the coach can return to — every edit session is ephemeral until rendered. **Recommend Option 1** for the JTBD "leave and come back," but Option 2 is a valid Phase-1-only shortcut if the owner wants the absolute minimum schema change.

RLS for `video_projects`: copy the four `video_edits` policies verbatim (select/insert/update/delete `USING/WITH CHECK (workspace_id = current_workspace_id())`).

---

## 4. Editor UI / UX

Lives in Promote → Video (extends `app/coach/promote/VideoStep.tsx` / `VideoEditor.tsx`). Keep it phone-usable (the ICP edits on their phone). Mono+Brass tokens already in use (`--accent`, `--bg-app`, etc.).

**Layout (top → bottom on mobile; could be two-column on desktop):**

1. **Clip picker / "Add clip."** Pulls the library via the existing `GET /api/videos?status=ready` (already returns `embed_url`, `mp4_url`, `thumbnail_url`, `duration_seconds`). Coach taps clips to add them to the timeline, or uploads a new one inline (the existing Bunny upload flow in `VideoStep.tsx` already produces a ready, transcribed source). Only `storage_provider = 'bunny'` clips with an `mp4_url` are eligible (renderable); grey out the rest with a hint.

2. **Timeline strip (the core new UI).** A horizontal row of clip "cards" in order, each showing a thumbnail, its trimmed duration, and a drag handle.
   - **Reorder:** drag-to-reorder (or simple up/down arrows on mobile as a fallback — arrows are the reliable, no-new-dep option for Phase 1).
   - **Remove:** an × on each card.
   - **Total duration** shown at the end (sum of trimmed clips) with a soft cap warning (e.g. ">60s tends to underperform as a Reel").
   - **Select a clip** to open its per-clip controls below.

3. **Per-clip controls (for the selected clip):**
   - **Trim in/out:** the existing two-range-slider pattern from `VideoEditor.tsx`, but scoped to the selected clip. (Phase 2: real draggable handles over a thumbnail filmstrip.)
   - **Reframe/crop:** a 9:16 frame overlaid on the source preview; coach drags the crop box / picks "fill (center)" vs "fit (letterbox)". Default = fill-center. (Phase 2 — Phase 1 can ship center-cover-by-default with no manual control and still fix the letterbox problem.)
   - **Captions toggle** for this clip (on/off).

4. **Project-level style.** The existing 3-button caption-style picker (`tiktok` / `minimal` / `none`) from `VideoEditor.tsx`, applied to the whole project. (Later: a few "look" presets bundling font/position/animation.)

5. **Preview.** Phase 1: play each clip in its Bunny iframe + show the ordered layout strip (cheap, honest, no new dep). Phase 2: embed `@remotion/player` (APPROVAL needed) for a true WYSIWYG composite preview without rendering.

6. **Render + deliver.** One "Render Reel" button → creates the render job (project-based `video_edits` row) → reuse the exact polling UX already in `VideoEditor.tsx` (progress bar via `/render/status`). On done: `<video>` preview + **Download**, plus (Phase 3) "Save to library" (push the rendered MP4 back to Bunny — already the Phase-3 plan in `VIDEO-EDITOR-PLAN.md`) and "Use this clip" to hand the output to the AI-caption composer Promote already has.

**Guardrails in the UI:**
- Disable "Render Reel" while < 1 clip or total duration < ~1s (mirrors the `clipLen < 0.5` guard today).
- Re-use the existing idempotency story: the render route already prevents double-fire per source; extend the in-flight check to per-project.
- Surface the rate-limit / daily-quota messages already returned by `/render` (5/min, 40/day per workspace).

---

## 5. Phased plan (each phase independently shippable)

**Phase 1 — Two-clip sequence, no manual crop (smallest step beyond today).**
- New `TimelineVideo` composition (`remotion/TimelineVideo.tsx`) using `<Series>` of `OffthreadVideo` segments + the existing caption overlay, with **default center-cover** so 16:9 sources fill 9:16 (kills the letterbox bug as a side effect).
- Editor UI: add 2–4 clips from the library, per-clip trim (existing slider pattern), reorder via up/down arrows, project-level caption style.
- Persist via **Option 2** (`video_edits.timeline jsonb`, `source_video_id` nullable) **or** the `video_projects` table if the owner approves the schema now. Render via the existing Lambda path with the new composition's `inputProps`. Reuse the existing status polling + download UX verbatim.
- **Ship value:** a coach can stitch a few clips into one captioned vertical video and download it. This is the headline feature, achievable without a new vendor and with at most a `video_edits` column add.

**Phase 2 — Manual reframe + better timeline + live preview.**
- Draggable crop box (per-clip `crop` rect) over the source preview; fill/fit toggle.
- Real trim handles on a thumbnail filmstrip instead of sliders; drag-to-reorder.
- Embed `@remotion/player` for WYSIWYG composite preview (**APPROVAL: `@remotion/player`**).
- Adopt `video_projects` table (Option 1) for persistent drafts if not already done (**SCHEMA APPROVAL**).

**Phase 3 — Captions polish, save-back, transitions.**
- TikTok-style per-word caption animation (**APPROVAL: `@remotion/captions`**) + light per-clip transcript text editing (store edited cues in the timeline element).
- Push rendered MP4 back to Bunny + save into the library (Phase-3 of `VIDEO-EDITOR-PLAN.md`); "Use this clip" hands off to the Promote AI-caption composer.
- Optional simple cross-dissolve between clips (single transition type only).
- Replace render polling with Bunny/Lambda webhooks (already a noted Phase-3 idea).

Each phase leaves a working product; none requires the next to be useful.

---

## 6. Risks & mitigations

- **Lambda concurrency = 10 on this AWS account** (documented in `lib/remotion.ts` and `VIDEO-EDITOR-PLAN.md`). Multi-clip renders are longer than 12s single clips, so the fan-out matters more. Mitigation: keep `framesPerLambda` high (already 1000), cap project length in the UI, and **request a quota increase** (`npx remotion lambda quotas increase`) before this gets real usage. Risk is "slow render," not "broken render."
- **Long renders / timeouts.** `/render` runs the Lambda *kickoff* in `after()` with `maxDuration = 60`; the actual render happens on Lambda and is polled — so total render time isn't bounded by the Vercel function. Still, a 60s multi-clip Reel at 1080×1920 can take a few minutes. Mitigation: honest progress UI (already exists), generous client poll loop (status poller already loops 200×3s), and a per-project total-duration cap (e.g. ≤ 90s) in Phase 1.
- **Large uploads on mobile.** Already handled by the existing TUS resumable upload (`tus-js-client` in `VideoStep.tsx`) direct browser→Bunny. Multi-clip just means more uploads, not a new mechanism. Surface clear per-upload progress; consider a soft per-clip size hint.
- **Cost per render.** Pennies today; multi-clip is the same order of magnitude. The real cost lever is **abuse / runaway renders** — already capped by the rate limiter (5/min, fail-closed) and daily workspace quota (40/day) in `/render/route.ts`, plus the per-source in-flight idempotency guard. Extend the idempotency guard to per-project so a double-tap can't fire two multi-clip renders. **Bump the daily quota deliberately** if multi-clip raises real per-coach volume.
- **Source availability / signed URLs.** Sources are Bunny token-signed (`signBunnyUrl`, 3h expiry). A render must resolve fresh signed URLs server-side at kickoff (the route already does this for the single clip) — do the same per timeline clip. Don't trust client-supplied `mp4Url`; re-derive from the `videos` row by `sourceVideoId` (the route already re-reads `videos` workspace-scoped — keep that for every clip).
- **Remotion license boundary.** Free for ≤ 3-person companies (flagged in `VIDEO-EDITOR-PLAN.md`). Solo today = free. Revisit only if FoundOS hires past 3 — that's the trigger to reconsider option (C), not now.
- **Codec/fps mismatch between clips.** Sources are all Bunny-transcoded MP4s (consistent), so `<Series>` of `OffthreadVideo` should concat cleanly. Mitigation: render at the composition's fixed fps (30) regardless of source fps — Remotion resamples. Validate with a 2-clip mixed-orientation render in Phase 1.

---

### Key file references (all real, verified for this spec)
- `app/coach/promote/VideoEditor.tsx` — current single-clip trim + caption-style + render UI.
- `app/coach/promote/VideoStep.tsx` — Bunny upload (TUS) + library picker that feeds the editor.
- `app/api/coach/promote/render/route.ts` — creates `video_edits`, signs source, kicks off Lambda in `after()`; has rate-limit + daily-quota + idempotency guards.
- `app/api/coach/promote/render/status/route.ts` — polls Lambda, persists terminal state.
- `lib/remotion.ts` — `startCaptionedRender` / `getCaptionedRenderStatus`; `framesPerLambda: 1000` note about the 10-concurrency cap.
- `remotion/CaptionedClip.tsx` + `remotion/Root.tsx` — the single-clip composition (1080×1920, fps 30) to generalize into `TimelineVideo`.
- `lib/bunny.ts` — `signBunnyUrl`, `fetchBunnyCaptions`, `parseVtt`, `getBunnyVideo`, `bunnyEmbedUrl`.
- `app/api/videos/route.ts` — `GET /api/videos?status=ready` returns library rows with `embed_url`/`mp4_url`/`thumbnail_url`/`duration_seconds`.
- `supabase/migrations/20260528000000_video_editor_bunny_remotion.sql` — `video_edits` table + the workspace-scoped RLS pattern to copy for `video_projects`.
- `docs/VIDEO-EDITOR-PLAN.md` — the original single-clip plan + STATUS (AWS function, S3 bucket, Bunny token-auth, letterbox open item).

### Approvals this spec is waiting on (none acted upon here)
1. **Schema:** new `video_projects` table + additive `video_edits` columns (`project_id`, optional `timeline`). *(Option 2 needs only a single `video_edits.timeline` column if you want the minimal path.)*
2. **Packages (only when their phase lands):** `@remotion/player` (Phase 2 preview), `@remotion/captions` (Phase 3 caption animation). Nothing new for Phase 1.
