# Coach Studio — Phase 4: Meta Direct Auto-Post (Instagram + Facebook) — Design Spec

**Status:** DESIGN — approved section-by-section in brainstorm 2026-06-05. No code written yet.
**Date:** 2026-06-05
**Author:** Claude (COACH-OS dev agent), with owner (Josh)
**Extends:** `docs/superpowers/specs/2026-06-05-coach-studio-design.md` (the master Coach Studio spec; this fills in Phase 4 §6.3 / §7 / §9 at build-time detail).
**Builds on what is already LIVE in prod:** Studio editor (Phases 1–2), karaoke captions + scheduling (Phase 3), and the **`scheduled_posts`** table + **`share`-mode executor** (`/api/studio/dispatch-due`, fired by n8n workflow `MuFLALR3xNiUhhXI` every 10 min). `main == prod == 349b5b4`.

> **Read this first.** Phase 4 adds the **`auto`** publishing mode: at the scheduled time, the app posts the finished Reel **directly** to the coach's Instagram + Facebook via the Meta Graph API — no manual step. The existing **`share`** mode (reminder email → coach posts manually) **stays as the permanent default and fallback**; `auto` is purely additive and degrades to `share` whenever it can't run. The single biggest factor is **Meta App Review** — a weeks-long, owner-driven approval gate. Until it passes, `auto` works **only** for IG/FB accounts added as **app testers** (i.e. the owner). So we build the full pipeline now (works for the owner immediately) and start App Review in parallel; it flips on for all coaches when approved.

---

## 1. Problem statement & jobs-to-be-done

A coach renders a captioned vertical Reel in Studio and schedules it. Today (`share` mode) we email them a reminder at post time and they upload it by hand. Phase 4 closes the last gap: **"post it for me, automatically, at the time I picked."**

**JTBD:**
1. *"Connect my Instagram and Facebook once."*
2. *"When my scheduled time hits, post the Reel + caption to IG and FB without me touching it."*
3. *"If something goes wrong, don't silently drop it — tell me so I can post it myself."*

**Success = a scheduled `auto` post lands on the coach's real Instagram (Reel) and Facebook Page (Reel) at the scheduled time, with the chosen caption, with zero manual steps — and any failure falls back to the `share` reminder.**

---

## 2. Build-time research finding (changes a master-spec assumption)

A 2026 research pass against `developers.facebook.com` (cited in §13) confirmed the current Meta landscape and surfaced one change worth recording:

- **Instagram Basic Display API was shut down (Dec 2024)** — irrelevant to us (we only ever used professional-account APIs) but rules out old tutorials.
- **A newer "Instagram API with Instagram Login" path exists (since mid-2024)** that can publish to IG **without a linked Facebook Page**. The master spec predated/omitted it.
- **Owner decision (2026-06-05):** we use the **classic "Instagram API with Facebook Login"** path anyway — **one** Facebook Login that grants **both** Instagram (via its linked Page) **and** the Facebook Page. Rationale: a single connect button + a single token exchange + a single App Review submission. **Accepted trade-off:** every account (the owner's, and any future coach's) must have an **Instagram Business/Creator account linked to a Facebook Page**. The owner is setting this up from scratch regardless.

---

## 3. Scope decisions (locked in brainstorm 2026-06-05)

| # | Area | Decision |
|---|---|---|
| 1 | **Goal now** | Build the **full** auto-post pipeline now (works for the owner as app tester immediately) **and start Meta App Review in parallel**. Flip on for all coaches when approved. |
| 2 | **Platforms** | **Instagram + Facebook**, both. Vertical **Reels** on both (Studio output is 1080×1920). |
| 3 | **Connect design** | **Single Facebook Login (classic path).** IG reached via its linked Page through `graph.facebook.com`. One connection row per workspace. |
| 4 | **Posting model** | `auto` is additive to the existing `share`; **`share` stays default + fallback.** Any `auto` failure / missing connection → falls back to the `share` reminder email (never silently dropped). |
| 5 | **Execution** | The existing cron (n8n → `/api/studio/dispatch-due`, ~10 min) **advances a per-post state machine one step per tick** (Hobby-function-time safe; IG container async). No long-polling in a request. |
| 6 | **Token security** | Tokens **encrypted at rest** (AES-256-GCM, app-level, zero new packages), decrypted **server-side only**, never serialized to the client. |
| 7 | **Public output for Meta** | Meta **fetches the MP4 from a public URL** we provide → the saved-to-Library Bunny MP4, **freshly signed at publish time** (`signBunnyUrl`, long expiry). |

### Non-goals (OUT — keep it simple)
- ❌ TikTok / YouTube **direct** API auto-post (they remain `share`-mode; separate later decision).
- ❌ Instagram **feed photos / carousels / Stories**; FB **feed text/photo** posts. v1 = **Reels (vertical video) only**, matching Studio output.
- ❌ The "Instagram API with Instagram Login" (no-Page) path — explicitly not chosen (see §2).
- ❌ Analytics / insights pull-back (views, likes). Out of scope for Phase 4.
- ❌ Multi-account-per-platform per workspace (one connected Page + its IG per workspace in v1).
- ❌ Auto-generated captions changes — reuse the existing Promote AI caption writer already wired at the schedule step.

---

## 4. Architecture

### 4.1 Two added flows
**① Connect (once):** `Settings → Facebook Login (OAuth) → long-lived token → Page token + linked IG id → store encrypted in social_connections.`

**② Auto-publish (per scheduled post):** `cron tick → load connection → sign public MP4 URL → create IG container / start FB Reel upload → (next ticks) poll → publish → record external ids → status=posted.` Failure at any point → `share` reminder fallback.

### 4.2 Connect flow (classic Facebook Login)
```
GET /api/integrations/meta/start
  • build the Facebook OAuth dialog URL with scopes (§4.3) + a signed `state` (CSRF) stored in an httpOnly cookie
  • redirect the coach to Facebook

GET /api/integrations/meta/callback
  1. verify `state` against the cookie; exchange `code` → short-lived USER token
  2. exchange short-lived → LONG-LIVED user token (~60d)   [server-side; uses META_APP_SECRET]
  3. GET /me/accounts → the coach's Page(s) + a PAGE access token per Page  [Page tokens do NOT expire]
     • 1 Page → auto-select; multiple → coach picks (simple select)
  4. GET /{page-id}?fields=instagram_business_account{id,username}  → resolve linked IG user id + handle
  5. upsert ONE social_connections row for the workspace (fb_page_*, ig_*, tokens ENCRYPTED, scopes, status='active')
  • redirect back to Settings with a success/needs-IG state
```
If the selected Page has **no linked IG** (`instagram_business_account` null), store the connection with `ig_user_id = null` and surface "Link an Instagram Business account to this Page to enable Instagram auto-post" — FB auto-post still works.

### 4.3 Scopes (Facebook Login)
`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`. All require **App Review / Advanced Access** for accounts the app does not own (the owner's parallel track, §9). In Development/Standard Access they already work for **app roles (admin/dev/tester)** — how we test before approval.

### 4.4 Token lifecycle
- **Page access token** — the workhorse for **both** IG publish and FB publish. **Does not expire** under normal conditions (invalidated on password change / de-auth / permission revoke). Stored encrypted; primary credential.
- **Long-lived user token (~60d)** — stored encrypted for validation / re-deriving Page tokens; `token_expires_at` tracked. Phase 4c adds a lightweight validity check + a "Reconnect" prompt when a token is invalidated (we do **not** silently fail).
- The executor reads tokens via the **service-role** client only.

### 4.5 Publish state machine (the executor)
Refactor `/api/studio/dispatch-due` into one cron entry that calls two modules — **no n8n change**:
- `dispatchShareReminders()` — current behavior, unchanged.
- `dispatchAutoPosts()` — the new state machine, using pure Graph-API functions in `lib/studio/publish/meta.ts`.

```
Per mode='auto' post, one step per cron tick:

status='scheduled' AND scheduled_at <= now:
  • load social_connections for the workspace
      - missing / status!='active' / required platform unlinked
        → FALLBACK: send the share reminder email, status='reminded', error='<reason>'   (STOP)
  • videoUrl = signBunnyUrl(video.mp4_url, ~24h)         # public, Meta cURLs it; Bunny ≠ fbcdn
  • for each requested platform with no progress yet:
      IG: POST /{ig_user_id}/media (media_type=REELS, video_url, caption)
          → auto_progress.instagram = { state:'processing', container_id }
      FB: POST /{page_id}/video_reels upload_phase=start → upload (file_url=videoUrl)
          → auto_progress.facebook = { state:'processing', video_id }
  • status='processing'; attempts += 1

status='processing':
  • IG: GET /{container_id}?fields=status_code
        FINISHED → POST /{ig_user_id}/media_publish (creation_id) → external id; state='done'
        ERROR/EXPIRED → state='error'
  • FB: poll the reel/video status
        ready → POST /{page_id}/video_reels upload_phase=finish video_state=PUBLISHED → external id; state='done'
        error → state='error'
  • all requested platforms 'done' → status='posted', posted_at=now, external_post_ids={...}
  • any 'error' (or attempts > ~12 ≈ 2h) → status='failed', error=<detail>
        + send the share reminder as fallback (coach can post manually)
  • attempts += 1 each tick
```
**Idempotency:** a step is skipped once its `container_id` / `video_id` / external id exists in `auto_progress` → **no double-posts**. **Hobby-safe:** every tick is a few fast Graph calls; the long async wait lives on Meta's side, not in our function. IG containers live 24h, comfortably inside the retry window. Our outbound calls hit fixed `graph.facebook.com` (no SSRF surface); the only URL Meta fetches is our signed Bunny CDN URL (public, not an fbcdn/robots-blocked URL).

### 4.6 Output compliance (already satisfied by the render)
Studio output = **1080×1920, H.264 video / AAC audio, 30fps** → within IG Reels (9:16, H.264/HEVC, 23–60fps) and FB Page Reels (9:16, 1080×1920, 24–60fps, **3–90s**) specs. Enforce the existing **≤90s** cap (and a **≥3s** floor for FB) at schedule time for `auto`.

---

## 5. Data model

> ⚠️ **Owner approved to spec (2026-06-05). Migration STAGED — owner applies it in the Supabase SQL editor** (the MCP is read-only). Mirrors the workspace-scoped RLS pattern in `supabase/migrations/20260605030000_scheduled_posts.sql` / `video_edits` using `current_workspace_id()`.

**`social_connections`** (NEW) — one Meta connection per workspace

| column | type | notes |
|---|---|---|
| `id` | uuid PK `gen_random_uuid()` | |
| `workspace_id` | uuid NOT NULL → workspaces ON DELETE CASCADE | RLS scope |
| `coach_id` | uuid NOT NULL → profiles ON DELETE CASCADE | owner |
| `provider` | text NOT NULL DEFAULT `'meta'` | future-proofing (only `meta` in v1) |
| `fb_page_id` | text | connected Page id |
| `fb_page_name` | text | display |
| `fb_page_access_token` | text | **encrypted**; non-expiring Page token (IG + FB publish) |
| `ig_user_id` | text NULL | linked IG business account id (NULL if Page has none) |
| `ig_username` | text NULL | display |
| `user_access_token` | text | **encrypted**; long-lived user token (validation / re-derive) |
| `token_expires_at` | timestamptz NULL | user-token expiry (~60d) |
| `scopes` | text[] NOT NULL DEFAULT `'{}'` | granted scopes (debug / review) |
| `status` | text NOT NULL DEFAULT `'active'` | CHECK in (`active`,`expired`,`revoked`) |
| `created_at`/`updated_at` | timestamptz | `updated_at` trigger if that pattern exists |

Unique-ish: one active connection per `workspace_id` in v1 (enforce in the upsert; a partial unique index is optional).

**Additive to existing `scheduled_posts`:**
- `external_post_ids jsonb NULL` — final platform→post-id map (e.g. `{"instagram":"178...","facebook":"123..."}`)
- `auto_progress jsonb NULL` — in-flight per-platform state (container/video ids + sub-state + per-platform error)
- `attempts int NOT NULL DEFAULT 0` — retry/backoff guard
- **extend the `status` CHECK** to add `'processing'` → `('scheduled','reminded','processing','posted','failed','canceled')`

**RLS:** `social_connections` gets the four workspace-scoped policies (select/insert/update/delete `USING/WITH CHECK (workspace_id = current_workspace_id())`). **Token-column secrecy** is enforced in code: no client-reachable query selects the token columns; the client-facing connections route returns only `fb_page_name`/`ig_username`/`status`/`token_expires_at`. The executor uses the service-role client.

---

## 6. Token security

- New helper **`lib/crypto/secret-box.ts`** — **AES-256-GCM** via Node `crypto` (**zero new packages**). `encryptSecret(plaintext): string` → base64 of `iv(12) | authTag(16) | ciphertext`; `decryptSecret(s): string`. Random IV per call. Key = **`STUDIO_TOKEN_ENC_KEY`** (32-byte base64 env var the owner adds; I never touch `.env`). **Fail-closed** if the key is missing/invalid.
- Tokens are encrypted before insert/update and decrypted only inside server routes / the executor. They are **never** returned to the browser.
- Unit-tested via a throwaway `tsx` script (encrypt→decrypt round-trip + tamper-detection).

---

## 7. UI

**`app/coach/studio/scheduled/ScheduleForm.tsx`** — add a **"How to post"** toggle:
- **"Remind me — I'll post"** → `mode='share'` (default; works for everyone today).
- **"Auto-post for me"** → `mode='auto'`, **enabled only when the selected platform(s) are connected**; otherwise disabled with *"Connect Instagram & Facebook to auto-post →"* deep-linking to Settings. On submit, the body now includes `mode`. Enforce ≤90s/≥3s for `auto`.

**`app/coach/studio/scheduled/ScheduledContent.tsx`** — show a **mode badge** + the richer statuses (`scheduled`/`processing`/`posted`/`failed`/`reminded`/`canceled`); when `posted`, link to the live IG/FB posts from `external_post_ids`.

**`app/coach/settings/SettingsPageContent.tsx`** — new **"Auto-post / Social accounts"** card following the existing Stripe Connect / Google Drive integration pattern: **Connect** button → `/api/integrations/meta/start`; connected readout (`@ig_username · Page name`, token health); **Disconnect**; a "needs IG link" hint when `ig_user_id` is null.

---

## 8. API routes
- `GET  /api/integrations/meta/start` — build OAuth URL + signed `state` cookie, redirect.
- `GET  /api/integrations/meta/callback` — verify state, exchange code → long-lived → Page token → resolve IG → store (encrypted).
- `POST /api/integrations/meta/disconnect` — set `status='revoked'` (and best-effort Graph de-auth); keep the row for history or hard-delete (decide in plan; default soft).
- `GET  /api/integrations/meta/connections` — client-safe status (NO tokens).
- `GET/POST /api/studio/dispatch-due` — extended: runs `dispatchShareReminders()` **and** `dispatchAutoPosts()` (Bearer `CRON_SECRET`, unchanged auth; n8n unchanged).
- `POST /api/studio/scheduled` — accept `mode` ('share' default; validate 'auto' requires an active connection for each chosen platform).

---

## 9. Owner's Meta App Review track (parallel — start day 1)

Documented step-by-step in **`docs/studio-phase4-meta-setup.md`**. From scratch, in order:
1. **Instagram** — create account → switch to **Professional (Business or Creator)**.
2. **Facebook Page** — create one → **link the IG account to it** (Page settings → Linked accounts).
3. **Meta Business Portfolio** — create → **start Business Verification** (slowest gate — kick off immediately; required for Advanced Access).
4. **Meta Developer app** (type *Business*) → add products **Facebook Login** + **Instagram Graph API**.
5. **Configure** — OAuth redirect URI (our `/api/integrations/meta/callback` on prod), **Privacy Policy URL** (existing `/privacy`), 1024² app icon, app domains.
6. **Add the owner + the test IG/Page as app roles** (admin/dev/tester) → full end-to-end works in Standard Access **before** review.
7. **Record 1080p screencasts** of consent + a real publish for **each** permission; write tight per-permission use-case descriptions.
8. **Submit App Review** for the 6 scopes (§4.3) → ~1 week/cycle; plan for ≥1 rejection.
9. **On approval (Advanced Access)** → flip the gate (§10) → works for all coaches.

**Env vars the owner adds** (Vercel prod + local): `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION` (pinned, e.g. `v23.0`), `META_OAUTH_REDIRECT_URI`, `STUDIO_TOKEN_ENC_KEY` (32-byte base64). Until set, the connect flow + executor **no-op gracefully** (the feature is hidden / `auto` disabled) and `share` keeps working.

---

## 10. Security & guardrails (reuse existing patterns)
- **OAuth CSRF** — signed `state` + httpOnly cookie verified in the callback.
- **Token secrecy** — AES-256-GCM at rest, server-only, never client-serialized (§6).
- **No silent drops** — any `auto` failure / missing connection / unlinked IG → `share` reminder fallback.
- **Idempotent state machine** + `attempts` cap → no double-posts, no infinite retries.
- **Publish cap** — a light per-workspace daily cap (well under IG's 100/24h) via the existing `lib/spend-guard.ts` pattern.
- **Feature gate** — a **server-checked flag** controls who sees `auto`. Until App Review passes it's restricted to **admin/owner accounts** (which are also the Meta *app testers* — the only accounts Meta will grant the scopes to; we can't detect Meta-tester status, so we key the gate off our own admin check, not Meta's). Everyone else sees `share` only. After approval, flip the flag to open `auto` to all connected coaches. Ships Phase 4 to prod **dark** and flips on cleanly. Server-enforced (never client-only).
- **Rate limit** — connect/callback routes use the existing limiter; auth routes stay fail-open per app policy.

---

## 11. Phased roadmap (each slice independently shippable on `rebuild/v2`)

- **Phase 4a — Connect.** Staged migration (`social_connections` + `scheduled_posts` additive cols) + `lib/crypto/secret-box.ts` + `/api/integrations/meta/{start,callback,disconnect,connections}` + Settings "Auto-post" card. *Outcome: the owner can connect IG+FB; nothing posts yet.*
- **Phase 4b — Auto executor.** `lib/studio/publish/meta.ts` + `dispatchAutoPosts()` wired into `/api/studio/dispatch-due` + `ScheduleForm` mode toggle + richer `ScheduledContent`. *Outcome: end-to-end auto-post for the owner as app tester.*
- **Phase 4c — Hardening + go-live.** Token validity check + Reconnect prompts + the review-approved gate flip for all coaches.

The **owner Meta track (§9) starts at 4a kickoff** so Business Verification + App Review bake in parallel.

---

## 12. Risks & mitigations
- **Meta App Review rejection / latency** (weeks; can reject). → `share` is the always-there baseline; `auto` is additive; start early; keep the demo + use-case tight. Ship dark behind the gate (§10).
- **Business Verification** (solo founder) → needs a verifiable business entity; have registration details ready; it's the long pole — start first.
- **Token invalidation** (password change / de-auth) → detect on publish; mark `status='expired'`, prompt Reconnect, fall back to `share`.
- **IG container processing latency / 24h expiry** → the multi-tick state machine polls within the window; `attempts` cap then fallback.
- **Public-URL fetch by Meta** → use a freshly signed Bunny URL with generous expiry; Bunny is not fbcdn and not robots-blocked. Validate during the first real test render-publish.
- **Hobby cron granularity (≈10 min via n8n)** → `auto` posts publish within ~10–20 min of `scheduled_at`; acceptable for social. Finer timing would need Vercel Pro (out of scope).
- **Double-post** → idempotent progress keys; never recreate a container/upload that already has an id.
- **Per-account rate limit (IG 100/24h)** → light daily cap; far above realistic coach volume.

---

## 13. Sources (Meta docs, verified 2026-06-05)
- Instagram Platform overview — https://developers.facebook.com/docs/instagram-platform/overview/
- IG content publishing — https://developers.facebook.com/docs/instagram-platform/content-publishing/
- IG API with Facebook Login (content publishing) — https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/content-publishing/
- FB Page Reels publishing — https://developers.facebook.com/docs/video-api/guides/reels-publishing/ · https://developers.facebook.com/docs/graph-api/reference/page/video_reels/
- Permissions reference — https://developers.facebook.com/docs/permissions/
- App Review submission guide — https://developers.facebook.com/docs/app-review/submission-guide/
- Long-lived tokens — https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
- IG Basic Display shutdown — https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/

---

## 14. Testing
- **Pure logic** (throwaway `tsx` scripts, deleted after — repo jest is integration-only): `secret-box` encrypt/decrypt round-trip + tamper detection; state-machine transitions with Graph calls mocked; signed-URL building; `mode='auto'` validation (rejects when not connected).
- **Build gates**: `npx tsc --noEmit` per commit; `npm run build` green before deploy (stop dev server first — Windows `.next` conflict).
- **Real end-to-end** (owner-driven, once the Meta app exists): owner (app tester) connects → schedules an `auto` post of a short test clip → verify it lands on a throwaway IG + Page within a tick or two, with the caption, and `external_post_ids` populated.

---

## 15. Key file references (real, to extend)
- `app/api/studio/dispatch-due/route.ts` — current `share` executor; refactor into share + auto dispatchers.
- `app/coach/studio/scheduled/ScheduleForm.tsx` / `ScheduledContent.tsx` — schedule UI to extend.
- `app/api/studio/scheduled/route.ts` + `[id]/route.ts` — scheduled-post CRUD (accept `mode`).
- `lib/studio/scheduled.ts` — `PLATFORMS` + shared types.
- `app/coach/settings/SettingsPageContent.tsx` — integration-card pattern (Stripe Connect / Google Drive) to mirror.
- `app/api/integrations/google-drive/{start,callback}/route.ts` + `app/api/billing/stripe-connect/route.ts` — OAuth redirect/callback patterns to follow.
- `lib/bunny.ts` — `signBunnyUrl` (public MP4 for Meta), `bunnyEmbedUrl`.
- `lib/supabase/service.ts` — service-role client for the executor.
- `lib/spend-guard.ts`, `lib/rate-limit.ts` — guardrails to extend.
- `lib/log-server-error.ts` — fail-silent server error logging (wire into connect + executor).
- `supabase/migrations/20260605030000_scheduled_posts.sql` — RLS + table pattern to copy for `social_connections`.

---

## 16. Next step
Hand off to the **writing-plans** skill → a phased implementation plan starting with **Phase 4a (Connect)**, with the staged migration and the owner's Meta App Review track (§9) called out as a parallel, owner-driven track.
