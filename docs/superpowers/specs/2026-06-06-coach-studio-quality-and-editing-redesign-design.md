# Coach Studio — Output Quality & Editing Redesign — Design Spec

**Status:** DESIGN — approved section-by-section in brainstorm 2026-06-06 (visual companion). No code written yet.
**Date:** 2026-06-06
**Author:** Claude (COACH-OS dev agent), with owner (Josh)
**Relationship to other specs:**
- **Precedes** `docs/superpowers/specs/2026-06-05-coach-studio-phase4-meta-autopost-design.md` (Meta auto-post). Phase 4 publishes whatever Studio renders — so the reels must look good *first*. This spec is sequenced **before** Phase 4.
- Builds on the live Studio (Phases 1–3) and its render pipeline (`remotion/TimelineVideo.tsx`, `lib/remotion.ts`, AWS Lambda).

> **Why this exists.** The owner reported the rendered reels come out **pixelated**, **"squished"**, and that the editing process is **hard**. All three are real and diagnosable from the current code. There is no point auto-posting pixelated/squished reels to a coach's Instagram (Phase 4) — output quality is foundational. This spec fixes the quality bugs and rebuilds the editor into a simple guided wizard.

---

## 1. Symptoms → root causes (diagnosed from the live code)

| Symptom | Root cause(s) found |
|---|---|
| **Pixelated / soft** | (1) `lib/remotion.ts` renders frames as **JPEG (~quality 80)** *before* H.264 encoding → **double lossy compression**, worst on captions/motion. (2) The source `videos.mp4_url` may be a **lower-res Bunny rendition** that gets **upscaled** into 1080×1920 (worse when cropping/zooming). Both the live preview and the final render share the same source, so both look soft. |
| **"Squished"** | Landscape clips are **hard-cropped** into the 9:16 frame (sides chopped, subject jammed). And the **Reframe/crop math is wrong**: `coverStyle()` (`remotion/TimelineVideo.tsx` + `lib/studio/crop.ts`) treats the normalized crop — which `CropBox` authored in the *thumbnail's* coordinate space — as if it were the *9:16 display* space, ignoring the source's real aspect ratio → over-zoom / mis-frame on non-vertical clips. |
| **Editing is hard** | The editor is a **single screen with ~6 stacked panels** (preview, timeline, inspector, caption style, audio) → "too many fiddly steps." Trimming is **range sliders** (imprecise). Reframe is a **separate thumbnail box** (confusing, and mis-frames per above). The **live preview omits captions** (`StudioEditor` passes `captions: []`), so it doesn't match the final render. |

---

## 2. Decisions locked in brainstorm (2026-06-06)

| # | Area | Decision |
|---|---|---|
| 1 | **Editor shape** | A **guided wizard** (owner chose this over the all-at-once "one canvas" and the "pro two-pane" layouts). |
| 2 | **Wizard steps** | **Lean — 4 steps**: ① Clips · ② Edit clips (trim **and** frame together) · ③ Captions + Music · ④ Finish. |
| 3 | **Persistent preview** | A **live preview at the top of every step** showing the *real* reel (framing **and** captions) → true WYSIWYG. |
| 4 | **Landscape fill (default)** | **Color fill on pure black** — whole clip shown, nothing chopped. Removes "squished." |
| 5 | **Per-clip fill alternates** | **Blur fill** and **Crop (drag-to-position)** available per clip. Vertical clips already fill — unaffected. |
| 6 | **Trimming** | **Filmstrip with draggable in/out handles** + split (replaces the range sliders). |
| 7 | **Reframing** | **Drag the clip directly on the preview** within the fixed 9:16 frame; the crop math is **fixed** to use the source's real aspect. |
| 8 | **Sequencing** | **Quality first → editor rewrite → then Phase 4.** |

### Non-goals (keep it focused)
- ❌ No new render vendor; no new heavy packages beyond what's already installed (`@remotion/player` already in).
- ❌ No DB migration — the timeline is `jsonb`, so per-clip `fillMode` is an additive JSON field (default `'color'`), not a schema change.
- ❌ No transitions/effects/keyframing beyond the existing hard-cut + captions + audio.
- ❌ Not changing the caption *engine* (Bunny VTT, segment-level; karaoke word-timing stays approximated as today).
- ❌ Not touching Phase 4 / scheduling / publishing here.

---

## 3. Track 1 — Output quality (fixes pixelation + squish; ships on the current editor)

### 3.1 Encoder — stop the double compression
In `lib/remotion.ts`, both `startCaptionedRender` and `startTimelineRender` pass `imageFormat: 'jpeg'` with no quality tuning. Change to **`imageFormat: 'png'`** (lossless intermediate frames) — this removes the JPEG loss that softens captions/detail. Evaluate at build time:
- If PNG frames materially slow the Lambda render or hit the 10-concurrency cap, fall back to **`jpegQuality: 100`** (near-lossless, cheaper than PNG).
- Optionally set a quality-leaning `crf` (H.264 default ≈ 18; consider 16–18) and/or x264 preset; benchmark render time vs. quality. Keep modest — the JPEG removal is the dominant win.

### 3.2 Source resolution — stop upscaling
Verify what rendition `videos.mp4_url` points to (Bunny Stream MP4 fallback, e.g. `play_720p.mp4` vs `play_1080p.mp4`). **Use the highest available ≥1080p** so we feed Lambda a sharp source rather than upscaling a small file. If Bunny isn't generating a 1080p MP4 fallback, enable it on the library and store the best URL. *(Investigation item — confirm in the plan against the upload/transcode code that sets `mp4_url`.)*

### 3.3 Fill modes — the real "squished" fix
Add a per-clip **`fillMode: 'color' | 'blur' | 'crop'`** to the timeline clip shape (Zod in `lib/studio/timeline.ts`; default `'color'`). **Back-compat:** an existing clip with a non-null `crop` defaults to `fillMode: 'crop'` (preserve its intent); otherwise `'color'`. Implement all three in `remotion/TimelineVideo.tsx` (and mirror in the live preview, since they share the composition):
- **`color`** (default): black `AbsoluteFill` + the clip at **`objectFit: 'contain'`**, centered → whole clip on black. Vertical clips fill edge-to-edge (contain == cover for 9:16). **No crop math involved → cannot squish.**
- **`blur`**: background layer = the clip at `objectFit:'cover'` + CSS `filter: blur() brightness()`; foreground = the clip at `objectFit:'contain'`. (Two layers of the same source.)
- **`crop`**: `objectFit:'cover'` + a **correct** position transform (see §3.4).

### 3.4 Fix the crop/reframe math
Define the crop rect in **source space** and apply it using the **source's real aspect ratio** (not the thumbnail's, not the display frame's). The composition computes the transform from the source's intrinsic width/height so the chosen region maps exactly to the 9:16 output — identical in the live preview and the Lambda render. *(May require the source `width`/`height`: store them on `videos`, fetch from Bunny metadata, or read intrinsic size from the preview `<video>` and persist into the clip. Confirm in the plan.)* Because **Color fill is the default**, crop is opt-in — this fix makes the opt-in usable, but the default path no longer depends on it.

---

## 4. Track 2 — Editor redesign (Lean 4-step wizard)

A new `StudioWizard` replaces the single-screen multi-card `StudioEditor`. State (clips, per-clip trim/fill/captions, audio, caption style, title) and autosave are preserved; only the presentation/flow changes. **A persistent live preview sits at the top of every step.**

- **Step ① Clips** — add from library (the existing picker), **drag to reorder** (keep the ‹ › arrows as a fallback), remove. Render disabled with 0 clips / over the duration cap (reuse existing guards).
- **Step ② Edit clips** — per selected clip:
  - **Trim** on a **filmstrip with draggable in/out handles** + **Split**. *(Filmstrip thumbnails: ideally sampled frames from Bunny; v1 may repeat the single poster behind the handles if per-time thumbnails aren't readily available — confirm in the plan.)*
  - **Frame**: pick `fillMode` (Color / Blur / Crop) and, for Crop, **drag the clip on the preview** to position. Captions on/off per clip.
- **Step ③ Captions + Music** — caption **style** picker (karaoke/bold/minimal/off) + **fix words** (edit cue text), shown **live on the preview**; **music + voiceover** upload/record + 3-slider mix (reuse `AudioPanel`). All optional.
- **Step ④ Finish** — full WYSIWYG preview → **Export** (reuse `RenderPanel` → existing Lambda render) → on done: **Save to Library / Download / Schedule** (existing actions; "Schedule" is the entry to Phase-4's flow later).

### 4.1 WYSIWYG preview — captions in the live preview
Today `LivePreview` is fed `captions: []`. To make the preview match the output, the editor must hold the caption cues. Cues come from each clip's Bunny VTT, which is **signed server-side**. Approach: a small server endpoint returns the **assembled, timeline-offset cues** for the current clips (reusing the exact render-time logic: `fetchBunnyCaptions` + `offsetCues` from `lib/studio/captions.ts`), called debounced as the timeline changes; pass the result into `LivePreview`'s `captions`. This guarantees preview/render parity. *(Alternative: return raw cues per video and assemble client-side with the pure `offsetCues` — choose in the plan; the server-assembled route is the safer parity choice.)*

### 4.2 Preview source must be browser-playable
`@remotion/player` plays `mp4_url` in a `<video>`. Confirm the preview is fed a **signed, browser-playable MP4** (not an unsigned URL or HLS — the latter was the library "gray screen" cause, fixed for playback via iframe but the player needs a real MP4). If the current preview source isn't signed, route it through a signed URL. *(Investigation item — may explain part of the bad-looking preview today.)*

---

## 5. Data & files

**No DB migration.** `video_projects.timeline` is `jsonb`; add `fillMode` (default `'color'`) to the clip shape + Zod schema. Everything else reuses existing tables/routes.

**Key files:**
- `lib/remotion.ts` — encoder settings (§3.1); render input types gain `fillMode`.
- `remotion/TimelineVideo.tsx` — fill modes (§3.3) + fixed crop transform (§3.4) + (preview parity) captions already supported by `CaptionLayer`.
- `lib/studio/timeline.ts` — Zod `fillMode` + clip shape; `lib/studio/crop.ts` — corrected transform helper.
- `app/api/studio/render/route.ts` — pass `fillMode` + sign the **highest-res** source.
- `app/coach/studio/StudioEditor.tsx` → new `StudioWizard` + step components; reuse `RenderPanel`, `AudioPanel`, `CropBox` (adapted to drag-on-preview), `LivePreview`.
- `app/coach/studio/LivePreview.tsx` — accept assembled captions.
- New: a caption-cues endpoint for the preview (§4.1); possibly source `width/height` handling (§3.4).
- `app/api/videos/route.ts` / upload-transcode path — confirm `mp4_url` rendition (§3.2).

---

## 6. Phasing (each independently shippable on `rebuild/v2`)

- **Phase A — Output quality** (visible win on the *current* editor, low risk): encoder fix (§3.1) · highest-res source (§3.2) · fill modes with **Color-on-black default** + a simple fill-mode toggle in today's Reframe UI (§3.3) · fixed crop math (§3.4). *Reels immediately look right; nothing structural changes.*
- **Phase B — Editor rewrite**: the Lean 4-step `StudioWizard` (§4) · filmstrip trim with handles · drag-to-reframe on the preview · **WYSIWYG captions in the live preview** (§4.1) · preview source signing (§4.2).

Then proceed to the **Phase 4 (Meta auto-post)** spec.

---

## 7. Risks & mitigations
- **PNG frames → slower/larger Lambda renders** (concurrency cap 10). → Benchmark; fall back to `jpegQuality: 100`; keep the ≤90s cap.
- **Crop math needs source aspect** (`width`/`height` not be stored). → Store on `videos`, fetch from Bunny, or read intrinsic size in the editor; Color-fill default means crop isn't on the critical path.
- **Live preview source** unsigned/HLS → blank/soft preview. → Route through a signed MP4 (§4.2); verify early.
- **`@remotion/player` performance** with multiple clips + blur layers on phones. → Test on a real device; blur only when `fillMode='blur'`.
- **Filmstrip thumbnails** from Bunny may not be per-timestamp. → v1 can approximate with the poster; upgrade later.
- **Editor rewrite regressions** (autosave, project load). → Preserve the data model + autosave; rewrite is presentation-only; verify load/save parity.

---

## 8. Testing
- **Pure logic** (throwaway `tsx`, repo jest is integration-only): fill-mode style computation; the corrected crop transform (a landscape source maps the chosen region exactly to 9:16); caption-cue assembly/offset.
- **Quality A/B** (owner-driven): render the same project before/after the encoder + source fixes; confirm captions/detail are visibly sharper and landscape clips are no longer chopped.
- **Preview parity**: the live preview's framing + captions match the rendered MP4.
- **Build gates**: `npx tsc --noEmit` per commit; `npm run build` green (stop dev server first — Windows `.next` conflict).

---

## 9. Next step
Hand off to **writing-plans** → a phased implementation plan starting with **Phase A (output quality)**, then **Phase B (editor wizard)**.
