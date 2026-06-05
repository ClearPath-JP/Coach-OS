# Video playback fix — handoff (2026-06-04, branch `rebuild/v2`)

You uploaded `DSCF1900.mov`, it went gray and wouldn't play. Root cause + full fix below.
**Nothing here is committed or deployed** — it's all in your working tree for review.

## Root cause (one line)
Bunny finishes transcoding to **HLS** and we stored the `.m3u8` as `playback_url`, then fed it
to a **native `<video>` element**. Only Safari can play HLS natively — Chrome/Edge/Firefox show
gray. The 1–3 min wait was normal transcoding; the `.mov`/Fujifilm codec was never the problem.

## What plays video, and its status (the audit)
| Surface | File | Source | Status |
|---|---|---|---|
| Coach video library — player modal | `app/coach/videos/VideosPageContent.tsx` | Bunny HLS | **FIXED → iframe** |
| Coach video library — card preview/poster | same | Bunny mp4 + thumbnail | **FIXED → mp4 + `<img>`** |
| Client program video | `app/client/(main)/programs/[id]/ClientProgramDetailContent.tsx` → `VideoPlayer` | Bunny HLS | **FIXED → iframe** |
| Coach assignment review | `components/coach/AssignmentReviewModal.tsx` → `VideoPlayer` | Supabase MP4 | OK (proxy `<video>`) — hardened |
| Client submission view | `components/client/AssignmentSubmitModal.tsx` → `VideoPlayer` | Supabase MP4 | OK (proxy `<video>`) — hardened |
| Session recap | `app/coach/schedule/SessionDetailDrawer.tsx` | Supabase MP4 (`/api/client/videos/upload`) | OK — not Bunny |
| Promote upload preview | `app/coach/promote/VideoStep.tsx` | Bunny iframe | OK (was already correct — the reference pattern) |
| Promote render output | `app/coach/promote/VideoEditor.tsx` | Remotion MP4 | OK |
| Program-editor video picker | `components/coach/VideoSelectModal.tsx` | `next/image` thumbnail | ⚠️ pre-existing gap (see Follow-ups) |

## Changes
**Coach side (done before you left):**
- `lib/bunny.ts` — added `bunnyEmbedUrl()` (URL-encoded).
- `app/api/videos/route.ts` — list now returns `embed_url` + **signed** `mp4_url`/`thumbnail_url`
  (signing is a no-op when token auth is off, safe either way).
- `app/coach/videos/types.ts` — added `mp4_url`, `embed_url`.
- `app/coach/videos/VideosPageContent.tsx` — iframe player; mp4 hover-preview + thumbnail poster
  (graceful fallback to thumbnail, never gray); refetch-on-ready so live uploads hydrate.

**Client side + shared player (done while you were out):**
- `lib/video-stream-access.ts` — `getVideoStreamRow` now also selects `bunny_video_guid`, `bunny_library_id`.
- `app/api/videos/[id]/token/route.ts` — returns an **access-gated** `embedUrl` (only after the
  existing `userCanStreamVideo` check passes — the GUID is never exposed to someone who can't watch).
- `components/ui/VideoPlayer.tsx` — uses Bunny's iframe when an `embedUrl` comes back (allowlist-
  checked against `https://iframe.mediadelivery.net/` before it ever reaches an `<iframe src>`),
  otherwise the existing authenticated proxy `<video>`. One component fix covers client program
  videos + both assignment surfaces.

**Security header (required for the previews to actually render):**
- `next.config.ts` — added `https://*.b-cdn.net` to **`img-src`** and **`media-src`** (it was only in
  `connect-src`). Without this, the thumbnail posters and MP4 previews are silently CSP-blocked in prod.
  Narrow + reversible; `*.b-cdn.net` is your own Bunny CDN, already trusted for uploads.

**Tests (new, additive):**
- `jest.unit.config.cjs` + `__tests__/_stubs/server-only.cjs` + `__tests__/bunny.unit.test.ts` —
  a standalone **unit lane** (no live server/DB, unlike your numbered integration suites).
  Run with `npm run test:unit`. 7 tests for `bunnyEmbedUrl` + `signBunnyUrl` (incl. the URL-encoding
  hardening). `package.json` got a `test:unit` script.

## Verification
- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed files — clean (only pre-existing warnings elsewhere).
- `npm run build` — **exit 0 / green** (full production build).
- `npm run test:unit` — **7/7 pass**.
- ⚠️ NOT runtime-tested: the iframe actually playing needs a real browser + (for the client path) a
  client login. Verify on a preview deploy — I avoided hammering the prod DB / long-running dev server.

## What needs YOU
1. **Confirm `BUNNY_STREAM_TOKEN_KEY` is set in Vercel prod** (project `sensei-app`, Production + Preview).
   Verified 2026-06-04: the library has **"Block Direct URL File Access" ON**, so mp4 + thumbnail URLs
   **must** be signed. `signBunnyUrl()` does this, but it's a silent no-op if the key is missing in prod —
   without it, playback still works (the embed needs no key) but **thumbnails + hover-previews 403** (gray
   cards). The key is valid locally (signing → 200 verified). See `docs/VERCEL-ENV.md`.
2. **Enable Bunny "MP4 Fallback"** (Stream → Kindo Coach Videos → Encoding) — powers the hover-preview
   clips. Playback + thumbnails work without it. `DSCF1900` will now *play*, but its hover-clip may be
   missing (its `mp4_url` predates the toggle) — re-upload it to get the clip.
3. **Deploy** to apply (these changes are local on `rebuild/v2`).

## Security readout — RESOLVED (verified 2026-06-04, direct CDN/embed probe — no dashboard needed)
Library `672196` "Kindo Coach Videos", CDN `vz-328fcdea-402.b-cdn.net`:
- **Embed View Token Authentication: OFF** — a real video's *unsigned* embed returns the full player
  (49.8 KB) vs a 2.8 KB not-found stub for a bogus GUID. → The iframe fix ships **as-is, no embed signing**.
- **Block Direct URL File Access (CDN token auth): ON** — unsigned mp4/thumbnail → 403; signed → 200.
  `lib/bunny.ts` signs with **Basic (MD5)**, verified → 200 (Advanced V2 also passes; **no code change**).
  → Hard dependency on `BUNNY_STREAM_TOKEN_KEY` in prod (see "What needs YOU" #1).
- **Allowed Referrers** — not blocking the embed (it loaded from a server with no browser Referer); CDN
  files are gated by token, not referrer. No `coach.foundos.ai` 403 risk observed.

> Note on the wrong-account Chrome report: the agent was logged into `jpotesta15@outlook.com` (a fresh
> trial with **zero** libraries). The real library `672196` lives under a different Bunny login — but the
> Phase-1 readout above no longer needs the dashboard. Direct dashboard URL if ever needed:
> `https://dash.bunny.net/stream/672196`.

## Follow-ups (pre-existing, NOT fixed — flagging only)
- `VideoSelectModal.tsx` uses `next/image` for thumbnails, but `*.b-cdn.net` isn't in
  `next.config.ts → images.remotePatterns`, so Bunny thumbnails in the program-editor video picker
  won't optimize (blank). Fix: add `{ protocol: 'https', hostname: '**.b-cdn.net', pathname: '/**' }`,
  or set `unoptimized` for Bunny thumbnails there (cleaner for signed/short-lived URLs).
- `SessionDetailDrawer` recap video doesn't reload on reopen (only shows right after upload) — minor,
  unrelated to this bug.
