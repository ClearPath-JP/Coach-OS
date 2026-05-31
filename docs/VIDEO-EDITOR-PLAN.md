# In-app video editor — build plan (Bunny Stream + Remotion on AWS Lambda)

Goal: in `/coach/promote` Video path, let a coach **upload a clip → trim it → burn in auto-captions → render → post**.
Chosen stack (2026-05-28): **Bunny.net Stream** (storage + delivery + transcription) · **Remotion on AWS Lambda** (rendering). Founder wants to learn Remotion/Lambda; longer build is fine.

Grounded in current docs:
- Remotion Lambda: `renderMediaOnLambda()` → S3, track with `getRenderProgress()`. https://www.remotion.dev/docs/lambda/rendermediaonlambda
- Trim: `<OffthreadVideo src trimBefore trimAfter />` (frame-based). https://www.remotion.dev/docs/offthreadvideo
- Captions: `@remotion/captions` (`createTikTokStyleCaptions`). https://www.remotion.dev/docs/captions
- Bunny Stream auto-transcribes every upload (Whisper) → transcript/captions via API. https://bunny.net/blog/introducing-transcribe-ai-for-bunny-stream/
- Bunny upload: HTTP API + resumable (TUS) + pre-signed. https://support.bunny.net/hc/en-us/articles/360021070999

---

## Why this stack is good
- **Bunny does triple duty:** upload + transcode + **free Whisper transcription** + HLS/MP4 + player + thumbnails. No separate Deepgram/AssemblyAI needed — captions come from Bunny's transcript.
- **Remotion = video in React.** The composition is just a React component; trim = `OffthreadVideo` props, captions = an overlay component. Renders on Lambda, pay-per-render only.
- Both are cheap and scale to zero.

## Architecture / pipeline
```
Coach picks "Upload & edit a clip" (Promote → Video)
  1. Browser uploads clip → Bunny Stream (pre-signed/TUS, direct browser→Bunny)
  2. Bunny transcodes + auto-transcribes (Whisper) → MP4 + HLS + VTT captions
  3. We poll Bunny status; save video GUID + URLs + captions in Supabase
  4. Editor UI: Bunny player preview → set trim in/out, pick caption style
  5. POST /api/coach/promote/render → renderMediaOnLambda(composition, inputProps:{mp4Url, trimIn, trimOut, captions, style})
        Remotion composition = <OffthreadVideo trimBefore trimAfter> + <Captions overlay>
        → renders on Lambda → MP4 in S3
  6. Poll getRenderProgress → on done, upload rendered MP4 back to Bunny → save to library
  7. Coach downloads/【posts】 the captioned clip + pairs it with the AI caption from Promote
```
Async (transcode + render take seconds–minutes): track status rows in Supabase; poll first, webhooks later.

## Data model (NEEDS APPROVAL — Supabase migration)
- Extend `videos` (or add columns): `provider` ('bunny'|'drive'|'supabase'), `bunny_library_id`, `bunny_video_guid`, `hls_url`, `mp4_url`, `thumbnail_url`, `captions_vtt_url`, `duration_seconds`, `status`.
- New table `video_edits`: `id`, `workspace_id`, `coach_id`, `source_video_id`, `trim_start_sec`, `trim_end_sec`, `caption_style`, `status` (queued|rendering|done|failed), `remotion_render_id`, `remotion_bucket`, `output_guid`, `output_url`, `error`, `created_at`. + RLS (workspace-scoped, mirror existing video policies).

## Packages (NEEDS APPROVAL — `npm i`)
- `remotion`, `@remotion/cli`, `@remotion/lambda`, `@remotion/captions`, `@remotion/bundler`/`@remotion/renderer` (as needed)
- Upload: `tus-js-client` (resumable browser→Bunny) — or use Bunny pre-signed PUT (no package)
- (Remotion is a separate sub-project/folder so its React version is isolated from the Next app.)

## Env vars (you add the secret values — I never touch .env)
- `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOST`
- `REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`, `REMOTION_APP_REGION`, `REMOTION_APP_FUNCTION_NAME`, `REMOTION_APP_SERVE_URL`

## ⚠️ Remotion license
Remotion is **free for individuals and companies ≤ 3 people**; a paid **Company License** kicks in above that. Solo today = free. Flag for when FoundOS grows / hires.

---

## Phases (ship value each phase, not one giant drop)

### Phase 0 — Accounts + infra (YOU set up; I provide exact steps)
- Bunny.net account → create a **Stream library** → copy **Library ID** + **Stream API key** + CDN hostname. Enable **MP4 fallback** (auto-transcription is on by default).
- AWS account → IAM user with the Remotion policy (I'll generate via `npx remotion lambda policies`) → access key + secret. Pick region (us-east-1).

### Phase 1 — Upload to Bunny + captions in the Video path (shippable on its own)
- Supabase migration (approved). Browser→Bunny upload in the Video step, poll until ready, show the Bunny player + auto-transcript. Coach can upload + get a hosted, transcribed clip and pair it with the AI caption. **No rendering yet — already useful.**

### Phase 2 — Remotion composition + Lambda render (editor core)
- Remotion sub-project: composition = `OffthreadVideo(trimBefore/trimAfter)` + caption overlay from the VTT (`createTikTokStyleCaptions`), inputProps-driven.
- `npx remotion lambda functions deploy` + `sites create` (run with your AWS creds) → functionName + serveUrl.
- `/api/coach/promote/render` (renderMediaOnLambda) + `/api/coach/promote/render-status` (getRenderProgress). Editor UI: trim slider + caption-style picker → Render → progress bar → result.

### Phase 3 — Output back to Bunny + polish
- Upload rendered MP4 to Bunny, save to library + `video_edits`. Transcript text editing, thumbnail pick, multiple caption styles, webhooks instead of polling.

## Rough cost
- Bunny Stream: ~$0.005/GB stored + ~$0.01/GB delivered; transcode + transcription included. Pennies at this scale.
- AWS Lambda (Remotion): pay-per-render, ~$0.01–0.05 per short clip; S3 negligible. Free tier covers early use.

## What unblocks me to start
1. **Approve packages** (list above).
2. **Approve the Supabase migration** (data model above) — I'll write it for review before applying.
3. **Phase 0 accounts** — Bunny library + key, AWS IAM creds. Then I start Phase 1.

---

## STATUS — 2026-05-31 (session 24)

- **Phase 1 — DONE & verified** (upload → Bunny transcode → captions → player).
- **Phase 2 — render engine VERIFIED on real frames** (not just exit codes):
  - Local render of the fixture → correct 12s trim, 1080×1920, burned-in captions.
  - **Cloud render on AWS Lambda** of a real external mp4 → downloaded 5.28MB, captions correct.
  - Render of the **live signed Bunny source** (private clip) → correct output. This is the
    production data path: raw mp4 = 403, signed = 200.
- **AWS deployed (us-east-1):** role `remotion-lambda-role`, deployer user `remotion-deployer`,
  function `remotion-render-4-0-468-mem2048mb-disk2048mb-120sec`, site `kindo-captioned`.
  Bucket `remotionlambda-useast1-rczpiznaa1`. Full IAM steps: `docs/AWS-REMOTION-SETUP.md`,
  `docs/AWS-CHROME-SCRIPT.md`. Policy JSON: `remotion/aws/`.
- **Bunny access — root cause corrected:** the mp4 block was **"Block direct URL access"**
  (a Referer check), NOT token auth. Fix = enable CDN Token Authentication; `signBunnyUrl()`
  (Basic MD5) now signs the source (200) while raw stays private (403). Token key is in `.env.local`.
- **New-AWS-account gotcha:** Lambda concurrency = 10 → `framesPerLambda: 1000` in `lib/remotion.ts`
  keeps short clips on one function. Raise quota for long clips (`npx remotion lambda quotas increase`).

### Still to do
- In-app browser verification of the full Promote→Video→render flow (`screenshots/verify-video-editor.mjs`).
- Vercel prod env: `BUNNY_STREAM_*` (+ `_TOKEN_KEY`) + `REMOTION_*` before merging `rebuild/v2` → main.
- Phase 3: push the rendered mp4 back to Bunny + wire into the composer/scheduler.
- Composition: 16:9 sources letterbox at the top of the 9:16 frame — consider a fill/cover option.
