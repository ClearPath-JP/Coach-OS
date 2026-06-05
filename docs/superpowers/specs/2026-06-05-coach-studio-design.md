# Coach Studio — Multi-Clip Editor, Audio, Captions & Scheduled Publishing — Design Spec

**Status:** DESIGN — approved section-by-section in brainstorm 2026-06-05. No code written yet.
**Date:** 2026-06-05
**Author:** Claude (COACH-OS dev agent), with owner (Josh)
**Supersedes / extends:**
- `docs/superpowers/specs/2026-06-05-multiclip-video-editor-design.md` (the deferred multi-clip editor design — this spec keeps its render architecture and **adds** audio, karaoke captions, the Studio IA, and the publishing/scheduling system).
- `docs/VIDEO-EDITOR-PLAN.md` (the single-clip editor already live in production).

> **Read this first.** Everything here builds on a stack that is **already paid-for, deployed, and verified in production**: Bunny.net Stream (host + transcode + Whisper captions) and Remotion on AWS Lambda (render). The single-clip editor (`app/coach/promote/VideoEditor.tsx`) already does trim + caption-style + Lambda render today. This spec turns that into a **CapCut-style multi-clip studio with audio and one place to schedule + publish** — without adding a new render vendor.

---

## 1. Problem statement & jobs-to-be-done

A solo martial-arts / fitness coach films short clips on their phone and wants to turn them into one polished, captioned vertical video and get it onto Instagram/Facebook — today that means leaving the app for CapCut + a separate scheduler. We want that whole loop inside Coach OS.

**Jobs-to-be-done:**
1. *"Stitch 2–4 of my clips into one vertical Reel."* Pick clips from my library, put them in order.
2. *"Trim and split each clip to just the good parts."* Per-clip in/out, and cut a clip in two at the playhead.
3. *"Make it fill the screen vertically"* — no black bars on a landscape clip.
4. *"Add music and talk over it."* Drop in a music track and record a voiceover, and balance the levels.
5. *"Put my words on screen automatically"* — captions from the transcript, in a punchy style, with the option to fix wrong words.
6. *"Save it, name it, download it"* — and keep it in my library.
7. *"Tell it when and where to post"* — schedule to Instagram/Facebook (and others), ideally hands-off.

**Success = a coach goes clips → finished captioned vertical video → scheduled post without leaving Coach OS.**

---

## 2. Scope decisions (locked in brainstorm 2026-06-05)

| # | Area | Decision |
|---|---|---|
| 1 | **Editor shape** | **Mobile-first timeline editor** that is **responsive** — single-column timeline on phones; expands into a desktop "studio" (library panel + selected-clip inspector) on large screens. One build, two layouts. |
| 2 | **Music** | **Upload-your-own only.** No bundled library in v1 (can seed a royalty-free pack later). We will **not** ship copyrighted/trending audio (legal). |
| 3 | **Voiceover** | **Record in-browser** over the preview, plus **three volume sliders**: clip audio / music / voiceover. Auto-ducking deferred. |
| 4 | **Captions** | **Karaoke word-by-word highlight** is the default look; **bold (TikTok)** and **minimal** also offered. All auto-generate from the transcript, are **editable** (fix words), and toggle per clip. |
| 5 | **Posting** | **Reminder + one-tap share** ships first (all platforms, no approvals). Build toward **Meta direct auto-post (Instagram + Facebook)**; start **Meta app review in parallel**. Same scheduling UI throughout; only the *executor* upgrades. |
| 6 | **Output** | Save back to library, **rename**, **download**. |
| 7 | **Render engine** | **Extend the existing Remotion-on-Lambda pipeline.** No new render vendor. At most one optional Remotion package (`@remotion/captions`), flagged for approval at build time. |
| 8 | **Placement (IA)** | A dedicated **Studio** nav area: **Edit / Projects / Scheduled**. The **Library** feeds it; Promote's AI caption writer is available at the schedule step. |
| 9 | **Data model** | New tables `video_projects`, `scheduled_posts`, (phase-B) `social_connections`; additive `video_edits.project_id`; a storage bucket for audio. All workspace-scoped RLS. **Owner approved to spec; migration will be STAGED for owner to apply** (per CLAUDE.md). |

### Non-goals (explicitly OUT — keep it simple)
- ❌ Bundled/stock/trending music; chroma key, masks, keyframed motion, PiP, multi-track **video** layering.
- ❌ Transitions beyond hard cut (a single cross-dissolve is a stretch-goal, not committed).
- ❌ Frame-accurate / broadcast editing, color grading, speed ramps.
- ❌ Auto-ducking of music under voice (v1 = manual volume sliders).
- ❌ TikTok / YouTube **direct** API auto-post (they ride the reminder+share baseline; direct APIs are a later, separate decision).
- ❌ Editing anyone else's footage — the coach's own library only.

---

## 3. Architecture

### 3.1 Two lanes

**① Create:** `Library → Editor (builds a "timeline" JSON) → Render on AWS Lambda → finished 1080×1920 MP4 → save to Library + rename + download.`

**② Publish:** `Finished video + caption → Schedule (when/where) → cron fires → Executor → [now] reminder+share | [later] direct post to IG+FB.`

### 3.2 Engine choice (and rejected alternatives)
**Extend Remotion/Lambda** (the deployed, verified pipeline). The editor produces a **timeline JSON**; we render it with a new `TimelineVideo` Remotion composition on the **same Lambda function and S3 bucket** already in use, polled by the existing status route.

- **Rejected — ffmpeg.wasm (browser render):** concat of mixed-codec phone clips requires in-browser re-encoding → slow, memory-hungry, **crashes mid-range phones** (our ICP edits on phones), and forces downloading private signed sources to the browser. Good for a trim-only toy, wrong for multi-clip.
- **Rejected — paid render API (Shotstack/Creatomate):** a **new recurring per-minute bill** + a third media vendor + uploading sources to them. Violates "prefer the paid-for stack; ask before adding paid services."

### 3.3 The timeline JSON (the contract between editor and renderer)
The editor's entire state serializes to one JSON object stored on `video_projects.timeline` / `.audio`. The render is **fully driven by this JSON** — Lambda never sees the UI. Validated **app-side with Zod** at render time (matches how `/render` already validates today). Client-supplied media URLs are **never trusted** — the render route re-derives signed source URLs from the `videos`/storage rows by id, workspace-scoped (as the single-clip route already does).

```jsonc
// video_projects.timeline  (ordered clip segments)
[
  {
    "sourceVideoId": "uuid",          // FK-by-value into videos (coach's clip)
    "inSec": 2.0,                      // per-clip trim in
    "outSec": 7.5,                     // per-clip trim out
    "crop": { "x": 0.1, "y": 0, "w": 0.5625, "h": 1 }, // normalized cover-crop; default center-cover
    "captionsOn": true,
    "captionEdits": null               // null = use transcript as-is; else edited cue text (Phase 3)
  }
]

// video_projects.audio  (project-level audio + mix)
{
  "musicAssetId": "uuid | null",       // uploaded track in the audio bucket
  "voiceoverAssetId": "uuid | null",   // recorded in-browser, uploaded to the audio bucket
  "volumes": { "clip": 1.0, "music": 0.5, "voiceover": 1.0 } // 0..1 per layer
}
```
Caption **cues** are still re-fetched from each source clip's Bunny VTT at render time (`fetchBunnyCaptions`), so transcripts stay the source of truth; only *edited* cue text (Phase 3) is persisted in `captionEdits`.

### 3.4 Render composition
- New `remotion/TimelineVideo.tsx`: a `<Series>` of `<Series.Sequence durationInFrames=…>`, each wrapping an `<OffthreadVideo src trimBefore trimAfter>` + that clip's caption overlay. `calculateMetadata` sums each clip's `(out−in)×fps` for total duration (same pattern as today's `remotion/Root.tsx`). Output stays **1080×1920 @ 30fps**.
- **Crop/reframe** is layout math in the composition (CSS `objectFit:'cover'` + transform per the normalized `crop` rect) — **no source re-encoding, no extra Bunny cost.** Default center-cover kills today's letterbox bug for free.
- **Audio** via Remotion `<Audio>`: one `<Audio>` for the uploaded music (looped/trimmed to total duration) + one for the voiceover, each at its mix volume; per-clip original audio volume applied on the `<OffthreadVideo>`. (Remotion mixes all audio into the output automatically.)
- **Captions:** Phase-1/2 reuse the existing hand-rolled overlay (bold/minimal). **Karaoke word-by-word (default look) requires per-word timing** — see Risks §9; likely `@remotion/captions` (**package approval at build time**).
- `remotion/CaptionedClip.tsx` stays for back-compat (single-clip renders keep working).

---

## 4. Information architecture — the Studio

New nav area **Studio** (coach surface), with three tabs:
- **Edit** — the timeline editor. Entry points: "New project," or "Use in Studio" from a Library card, or Promote's Video path (which becomes a shortcut into Studio).
- **Projects** — saved `video_projects` drafts (thumbnail, title, status, last edited) → reopen, duplicate, delete, render.
- **Scheduled** — `scheduled_posts` as an upcoming list + simple calendar (status: scheduled / posted / failed), plus a history of posted clips.

**Relationships:** Library is the **source of clips** (unchanged, stays its own page) and gains "Use in Studio." Promote's **AI caption writer** is reused at the schedule step to draft the post text. Rendered outputs **save back into the Library** (so they're reusable clips too).

---

## 5. Editor UX

Responsive; phone-first (ICP edits on phones). Mono+Brass tokens already in use.

**Phone (single column, top→bottom):** Preview → tool row (Split · Trim · Crop · Music · Voice · Captions) → horizontal **timeline strip** of clip cards (thumbnail + trimmed length + drag handle, `+` at the end to add from library) → contextual controls for the selected clip.

**Desktop (studio):** left **Library/clips** panel · center **Preview** over the **timeline** · right **Inspector** for the selected clip (trim/split/crop/captions) + project audio mix.

**Core interactions:**
- **Add clips** from `GET /api/videos?status=ready` (returns `embed_url`/`mp4_url`/`thumbnail_url`/`duration_seconds`). Only Bunny clips with an `mp4_url` are renderable; others greyed with a hint.
- **Reorder:** drag-to-reorder (phone fallback: up/down arrows — reliable, no new dep).
- **Trim:** two-range slider per selected clip (the existing `VideoEditor.tsx` pattern); Phase 2 → real handles on a thumbnail filmstrip.
- **Split:** cut the selected clip at the playhead into two adjacent timeline segments referencing the same source (in/out math only).
- **Crop/reframe:** a 9:16 frame over the preview; "fill (center)" default vs draggable crop box (Phase 2). Phase 1 ships center-cover by default.
- **Audio:** "Add music" (upload → audio bucket) and "Record voiceover" (in-browser `MediaRecorder` over the preview → upload to audio bucket) + the three volume sliders.
- **Captions:** style picker (karaoke default / bold / minimal / off-per-clip); "Edit words" opens the cue text for fixes (Phase 3 for persistence).
- **Preview:** Phase 1 = play clips in their Bunny iframes + the ordered layout strip (honest, no new dep). Phase 2 = embed `@remotion/player` for a true composite preview (**package approval**).
- **Render + deliver:** one "Render" button → project-based `video_edits` row → reuse the existing progress polling (`/render/status`) → on done: `<video>` preview + **Download** + **Save to Library** (rename inline) + **"Schedule this"** (→ Publish). *Mechanism:* **Download** serves the rendered MP4 from S3 directly; **Save to Library** re-ingests that MP4 into Bunny as a new `videos` row via the existing upload/transcode path (so the output becomes a reusable library clip).

**Guardrails (reuse what exists):** disable Render with <1 clip or <~1s total; per-**project** in-flight idempotency (extend the per-source guard); surface the existing rate-limit (5/min) + daily quota (40/day) messages; soft total-duration cap (≤90s) with a "Reels do better under 60s" hint.

---

## 6. Publishing & scheduling

### 6.1 Scheduling (built once, used by both executor modes)
A `scheduled_posts` row captures: the rendered video (`video_edit_id`), `platforms[]`, `caption`, `scheduled_at`, `mode` (`share` | `auto`), `status`. UI in **Studio → Scheduled** + a "Schedule this" action after render. Caption drafted via Promote's existing AI writer. A **cron** (`app/api/cron/*` + `CRON_SECRET` — pattern already in the app; Hobby = daily, so a near-term Vercel Pro bump buys finer granularity) scans due posts and runs the executor.

### 6.2 Executor — mode `share` (ships first, all platforms)
At `scheduled_at` the cron marks the post due and notifies the coach (email now; web-push optional later) with the finished video + caption ready. The coach opens the post in Studio → **Download** or **native share sheet** → posts to IG/FB/TikTok/YouTube themselves. Zero platform approvals, zero cost, works everywhere. Status → `posted` when the coach confirms (or auto after a window).

### 6.3 Executor — mode `auto` (Phase 4, Instagram + Facebook only)
Direct publish via the **Meta Graph API**, gated by **Meta App Review** (owner action — start early). Requirements & flow (verify against current Meta docs at build time — Meta changes):
- Coach connects via **Facebook Login**; needs an **Instagram Business/Creator** account linked to a **Facebook Page**. Store the long-lived token + account ids in `social_connections` (**encrypted at rest**, RLS-locked, never sent to the client).
- Permissions requiring review/Advanced Access: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`.
- **IG Reel publish:** create container (`POST /{ig-user-id}/media` `media_type=REELS&video_url=…&caption=…`) → poll container status → publish (`POST /{ig-user-id}/media_publish`). The rendered MP4 must be at a **publicly fetchable URL** for Meta to ingest (host the output so Meta can pull it).
- **FB Page video:** `POST /{page-id}/videos` with the video URL + Page access token.
- Limits: IG ~**50 API posts / 24h** per account; respect container-processing async; handle token expiry/refresh.
- Until review passes, `auto` works only for accounts added as **app testers** (i.e., the owner) — so `share` remains the default and the fallback.

---

## 7. Data model

> ⚠️ **Owner approved to spec (2026-06-05). Migration will be STAGED, not applied** — owner runs it in the Supabase SQL editor (the MCP is read-only). Mirrors the workspace-scoped RLS pattern in `supabase/migrations/20260528000000_video_editor_bunny_remotion.sql` using `current_workspace_id()`.

**`video_projects`** — the saved edit (draft you return to)

| column | type | notes |
|---|---|---|
| `id` | uuid PK `gen_random_uuid()` | |
| `workspace_id` | uuid NOT NULL → workspaces ON DELETE CASCADE | RLS scope |
| `coach_id` | uuid NOT NULL → profiles ON DELETE CASCADE | owner |
| `title` | text | e.g. "Armbar Reel" |
| `aspect` | text NOT NULL DEFAULT `'9:16'` | only 9:16 in v1 |
| `caption_style` | text NOT NULL DEFAULT `'karaoke'` | CHECK in (`karaoke`,`bold`,`minimal`,`none`). **`bold` == the existing `'tiktok'` overlay** (rename for clarity). Phase 1 UI offers `bold`/`minimal` only; `karaoke` lands Phase 3. |
| `timeline` | jsonb NOT NULL DEFAULT `'[]'` | ordered clips (shape §3.3) |
| `audio` | jsonb NOT NULL DEFAULT `'{}'` | music/voiceover refs + volumes (§3.3) |
| `status` | text NOT NULL DEFAULT `'draft'` | (`draft`,`rendering`,`rendered`,`failed`) |
| `last_render_edit_id` | uuid NULL → video_edits ON DELETE SET NULL | most recent render |
| `created_at`/`updated_at` | timestamptz | `updated_at` trigger if that pattern exists |

**`scheduled_posts`** — one row per scheduled post

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL → workspaces ON DELETE CASCADE | RLS scope |
| `coach_id` | uuid NOT NULL → profiles ON DELETE CASCADE | |
| `video_edit_id` | uuid NULL → video_edits ON DELETE SET NULL | the rendered MP4 |
| `project_id` | uuid NULL → video_projects ON DELETE SET NULL | source project |
| `platforms` | text[] NOT NULL | e.g. `{instagram,facebook}` |
| `caption` | text | post text (AI-drafted, editable) |
| `scheduled_at` | timestamptz NOT NULL | |
| `mode` | text NOT NULL DEFAULT `'share'` | CHECK in (`share`,`auto`) |
| `status` | text NOT NULL DEFAULT `'scheduled'` | (`scheduled`,`reminded`,`posted`,`failed`,`canceled`) |
| `posted_at` | timestamptz NULL | |
| `external_post_ids` | jsonb NULL | platform→post-id map (auto mode) |
| `error` | text NULL | last failure reason |
| `created_at`/`updated_at` | timestamptz | |

**`social_connections`** — *Phase 4 only; create when Meta auto-post lands*

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL → workspaces ON DELETE CASCADE | RLS scope |
| `coach_id` | uuid NOT NULL → profiles ON DELETE CASCADE | |
| `platform` | text NOT NULL | CHECK in (`instagram`,`facebook`) |
| `external_account_id` | text NOT NULL | IG user id / FB page id |
| `account_name` | text | display |
| `access_token` | text NOT NULL | **encrypted at rest**; never returned to client |
| `token_expires_at` | timestamptz NULL | refresh before expiry |
| `status` | text NOT NULL DEFAULT `'active'` | (`active`,`expired`,`revoked`) |
| `created_at`/`updated_at` | timestamptz | |

**Additive to existing `video_edits`:** add `project_id uuid NULL → video_projects ON DELETE CASCADE` so a render can point at a project. Keep `source_video_id` nullable for single-clip back-compat; snapshot the rendered `timeline jsonb` onto the edit row for an exact record (optional).

**Storage:** a bucket (e.g. `studio-audio`) for uploaded music + recorded voiceover. Render fetches these via **signed URLs**; add the storage host to the render-side **SSRF allowlist** (`lib/url-allowlist.ts`).

**RLS:** every table gets the four workspace-scoped policies (select/insert/update/delete `USING/WITH CHECK (workspace_id = current_workspace_id())`), copied from `video_edits`.

---

## 8. Security & cost guardrails (reuse existing)
- **Rate limit + daily spend ceilings** already protect render/AI routes (`lib/rate-limit.ts`, `lib/spend-guard.ts`) — extend to project renders + scheduled-post execution. Keep money routes fail-closed.
- **Per-project render idempotency** — extend the per-source in-flight guard so a double-tap can't fire two multi-clip renders.
- **SSRF allowlist** (`lib/url-allowlist.ts`) — add the audio storage host + (Phase 4) Meta's graph host for media fetch.
- **Token secrecy** — `social_connections.access_token` encrypted, server-only, never serialized to the client.
- **Signed sources** — re-derive every clip/audio URL server-side from ids at render kickoff (Bunny `signBunnyUrl`, 3h); never trust client URLs.
- **Public output for Meta** — the rendered MP4 needs a fetchable URL for IG/FB ingest; scope it tightly (expiring/unguessable).

---

## 9. Phased roadmap (each phase independently shippable)

**Phase 1 — Multi-clip editor core.** `TimelineVideo` composition (center-cover default → kills letterbox); add 2–4 clips, per-clip trim, **split**, reorder (arrows), project caption style (bold/minimal, reuse existing overlay); render via existing Lambda path; **save to Library + rename + download**. Studio shell (Edit/Projects) + `video_projects` table + additive `video_edits.project_id`. *Ships the headline value with no new vendor.*

**Phase 2 — Audio + reframe + live preview.** Music upload + in-browser voiceover + 3 volume sliders (Remotion `<Audio>` mixing) + `studio-audio` bucket; draggable crop box (fill/fit); thumbnail-filmstrip trim handles + drag-reorder; embed `@remotion/player` for composite preview (**pkg approval**).

**Phase 3 — Karaoke captions + scheduling + reminder-share publish.** Word-by-word caption animation (**`@remotion/captions` approval** + word-timing solution, §10) + edit-the-words; `scheduled_posts` + Studio → Scheduled UI + cron executor in **`share` mode** (reminder + one-tap share, all platforms) + Promote AI caption at schedule step. *Full create→schedule loop, no Meta dependency.*

**Phase 4 — Meta direct auto-post (IG + FB).** `social_connections` + Facebook Login + Graph API publish + `auto` executor mode. **Owner kicks off Meta App Review at the start of the project so it bakes in parallel** and flips on when approved.

---

## 10. Risks & mitigations
- **Word-level caption timing (default look).** Karaoke needs per-word timestamps; Bunny's Whisper VTT may be cue-level only. Mitigation: investigate Bunny word-timing first; if absent, either approximate (distribute cue duration across words) or run a one-time word-level transcription. Resolve in Phase 3, not Phase 1.
- **Meta App Review rejection / latency** (weeks; can reject). Mitigation: `share` mode is the always-there baseline; `auto` is additive; start review early; keep the app's use-case demo tight.
- **Lambda concurrency = 10** on this AWS account; multi-clip renders are longer. Mitigation: `framesPerLambda:1000` already set; cap project length; request a quota increase before real usage. Risk is "slow," not "broken."
- **Long renders / timeouts.** Kickoff runs in `after()` (maxDuration 60); actual render is on Lambda + polled, so not bounded by the Vercel function. Honest progress UI already exists.
- **Mobile uploads** — handled by existing TUS resumable upload (`tus-js-client`); more clips = more uploads, not a new mechanism.
- **Audio sync / mix** — validate a 2-clip + music + voiceover render early in Phase 2.
- **Cost / abuse** — pennies per render; real lever is runaway renders → existing rate-limit + daily quota + per-project idempotency; bump quotas deliberately if volume rises.
- **Remotion license** — free for ≤3-person companies; revisit only if FoundOS grows past that.

---

## 11. Approvals & owner actions
- ✅ **Schema** — approved to spec (2026-06-05); migration will be **staged**, owner applies.
- ⏳ **Packages (by phase, approval at build time):** `@remotion/player` (Phase 2 preview), `@remotion/captions` (Phase 3 karaoke), possibly a small audio-waveform UI lib (Phase 2 — evaluate building it without one first).
- ⏳ **Meta (owner, Phase 4):** create/verify a Meta developer app + Business account, submit **App Review** for the permissions in §6.3 — **start at project kickoff**.
- ⏳ **Infra:** decide Vercel Pro for sub-daily cron granularity (scheduling precision) + audio storage bucket creation.

---

## 12. Key file references (real, to extend)
- `app/coach/promote/VideoEditor.tsx` — current single-clip trim + caption-style + render UI (generalize into the Studio editor).
- `app/coach/promote/VideoStep.tsx` — Bunny TUS upload + library picker (reuse for clip add + audio upload).
- `app/api/coach/promote/render/route.ts` — creates `video_edits`, signs sources, kicks off Lambda in `after()`; rate-limit + quota + idempotency guards (extend to projects).
- `app/api/coach/promote/render/status/route.ts` — Lambda polling + terminal persistence.
- `lib/remotion.ts` — `startCaptionedRender`/`getCaptionedRenderStatus`; `framesPerLambda:1000`; the 10-concurrency note.
- `remotion/CaptionedClip.tsx` + `remotion/Root.tsx` — single-clip composition to generalize into `remotion/TimelineVideo.tsx` (1080×1920 @30).
- `lib/bunny.ts` — `signBunnyUrl`, `fetchBunnyCaptions`, `parseVtt`, `getBunnyVideo`, `bunnyEmbedUrl`.
- `app/api/videos/route.ts` — `GET /api/videos?status=ready` library rows.
- `lib/rate-limit.ts`, `lib/spend-guard.ts`, `lib/url-allowlist.ts` — guardrails to extend.
- `supabase/migrations/20260528000000_video_editor_bunny_remotion.sql` — `video_edits` + RLS pattern to copy.
- `app/api/cron/*` + `CRON_SECRET` — scheduled-job pattern for the publish executor.
- `docs/superpowers/specs/2026-06-05-multiclip-video-editor-design.md` — the prior editor design this extends.

---

## 13. Next step
Hand off to the **writing-plans** skill to turn this into a phased implementation plan (starting with Phase 1), with the staged migration and per-phase package approvals called out.
