# Message Media Attachments (Images + Short Video) on Coach ↔ Client Messages — Design

**Date:** 2026-06-16
**Branch:** design/dojo-arcade (proposed work; not started)
**Status:** SPEC ONLY — migration is PROPOSED and must be owner-approved before applying. No app code written. No migration run.

---

## 1. Context

Korva (COACH-OS) messaging is a one-thread-per-client coach ↔ client chat. Today messages are
**text-only** (plus rich "cards" that are really JSON-in-`content` rendered specially).

Verified in-repo:
- Table `public.messages` (`supabase/migrations/20240315000000_create_base_tables.sql` §messages):
  `id, sender_id (profiles), recipient_id (profiles), content TEXT NOT NULL, read_at, created_at,
  client_id` (later UUID FK to `clients` via `20240316000003`), and `message_type TEXT DEFAULT 'text'`
  (`20240316000007`). `message_type` already drives card rendering: `invoice | session |
  session_request | assignment | assignment_feedback | testimonial_request | session_notes`.
- RLS (`20240316000003_messages_client_id_and_rls.sql`):
  - SELECT: `sender_id = auth.uid() OR recipient_id = auth.uid()` (participant-based).
  - INSERT: `sender_id = auth.uid() AND workspace_id = current_workspace_id()`.
  - UPDATE: recipient only (read receipts), `20240316000002`.
- Send/read API: `app/api/messages/route.ts` (`POST` validates with `sendMessageSchema`,
  `lib/validations.ts`; stores `content.slice(0,2000)`, sets `message_type`). Coach service-role
  insert helper: `lib/messages/insert-thread-message.ts`.
- Rendering: `components/messages/MessagesThreadMessagesList.tsx` (the bubble switch on `message_type`;
  plain text is the fallback bubble). Composers: `app/coach/messages/MessagesPageContent.tsx`
  (`handleSend` → `POST /api/messages`, textarea at ~L567) and
  `app/client/(main)/messages/ClientMessagesContent.tsx`.
- Realtime is on for `messages` (`20240324000013_realtime_messages.sql`).

**Existing media infrastructure to reuse (do not reinvent):**
- **Bunny Stream** for video: `lib/bunny.ts` — `createBunnyVideo()` returns TUS creds for a direct
  browser→Bunny upload (API key never reaches the client), `getBunnyVideo()` polls encoding + builds
  CDN/HLS/thumbnail/iframe URLs, `bunnyEmbedUrl()` for cross-browser playback, token-auth signing
  (`signBunnyUrl`). Upload route precedent: `app/api/coach/promote/bunny/create/route.ts`
  (enforces plan storage cap, records a `videos` row). The `videos` table already supports
  `storage_provider='bunny'`, `bunny_video_guid`, `bunny_library_id`, `processing_status`,
  `uploaded_by_client_id` (`20260401140000`).
- **Supabase Storage** for images: established bucket pattern (`avatars`, `assignment-submissions`,
  `studio-audio`) created via SQL `INSERT INTO storage.buckets`. **Security direction (important):**
  the public-listing SELECT policies on those buckets were intentionally dropped
  (`20260607120100_drop_public_bucket_listing_policies.sql`) and the app now serves private content via
  **short-lived signed URLs** (`lib/storage-signing.ts`, `signSupabaseStorageUrl`, allow-list of
  signable buckets). `assignment-submissions` was made private in the 2026-06-11 security work.

### Hard constraints (project rules)
- Never modify schema/RLS without owner approval (this doc is that artifact). TypeScript only. No new
  packages without asking — **this needs zero new deps** (Bunny + Supabase Storage + Resend already in).
- Multi-tenant isolation is rated 90/100; **do not weaken RLS**. New rows stay workspace-scoped and
  participant-gated exactly like `messages`.

---

## 2. Goals / Non-goals

**Goals**
- Coach and client can attach **images** (jpg/png/webp/gif) and **short videos** to a chat message.
- Attachments render inline in the thread (image thumbnail → lightbox; video → Bunny iframe player).
- Storage choice is deliberate: **video → Bunny**, **images → Supabase Storage (private + signed URL)**.
- Enforce **size/type limits** and keep multi-tenant isolation airtight (no cross-workspace access; no
  anonymous enumeration).

**Non-goals (YAGNI for v1)**
- Arbitrary files (PDF/docs) — images + short video only (assignment file uploads already cover docs via
  `assignment-submissions`).
- Multiple attachments per message in the **first** cut is optional — schema supports many (1-row-per-
  attachment), UI ships with **one attachment per message** to start (simpler picker), expands later.
- In-chat video *trimming/editing* (that's Coach Studio).
- Audio messages / voice notes (later; `studio-audio` bucket + a new `attachment_type='audio'` would
  slot in).
- Counting message-image bytes toward the plan storage meter in v1 (images are tiny vs video; video
  attachments DO count, see §5.4). Revisit if abused.

---

## 3. Storage decision (and why)

| Media | Store in | Why |
|---|---|---|
| **Short video** | **Bunny Stream** | Already the app's video backbone (`lib/bunny.ts`). Gives transcoding, HLS, cross-browser iframe playback, auto thumbnails, and **token-auth signed playback** — none of which Supabase Storage provides. Direct browser→Bunny TUS upload keeps large files off our API. Reusing it means message-video playback behaves exactly like Library/Promote video (CSP already allows `iframe.mediadelivery.net` / `*.b-cdn.net`). |
| **Image** | **Supabase Storage (private bucket + signed URL)** | Images need no transcoding; Bunny Stream is video-only. A Supabase bucket is the established image path (`avatars`). Critically, the app already standardized on **private buckets + `signSupabaseStorageUrl`** after the 2026-06-11 security audit, so a new **private** `message-attachments` bucket fits that exact pattern (no public enumeration). Cheap, simple, fast for thumbnails. |

This mirrors the assignment-submissions design (video via Bunny `videos`, files via Supabase bucket) and
the security posture already shipped — consistency over novelty.

---

## 4. Data model (PROPOSED)

A dedicated `message_attachments` table (1 row per attachment) rather than columns on `messages`.
Rationale: keeps `messages.content` clean (it's overloaded with card-JSON already), supports >1
attachment without schema churn, and lets RLS be derived from the parent message. We still set
`messages.message_type` so the renderer branches cleanly.

```sql
-- PROPOSED migration: 20260616000500_message_attachments.sql
-- Additive. Safe to apply before code change (table simply unused until UI ships).

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  -- Who uploaded (always a participant of the thread). profiles.id, matches messages.sender_id.
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('image','video')),

  -- IMAGE (Supabase Storage, private bucket 'message-attachments'):
  storage_path TEXT,            -- object path within the bucket, e.g. '<workspace_id>/<message_id>/<uuid>.webp'
  mime_type TEXT,               -- e.g. image/webp
  width INTEGER,                -- optional, for layout (avoid reflow)
  height INTEGER,
  file_size_bytes BIGINT,

  -- VIDEO (Bunny Stream — mirror the videos table's columns):
  bunny_video_guid TEXT,
  bunny_library_id TEXT,
  processing_status TEXT DEFAULT 'queued'
    CHECK (processing_status IN ('queued','processing','ready','failed')),
  duration_seconds INTEGER,
  thumbnail_url TEXT,           -- Bunny CDN thumbnail (built by getBunnyVideo)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one storage backing must be populated for the declared type.
  CONSTRAINT message_attachments_image_fields CHECK (
    attachment_type <> 'image' OR (storage_path IS NOT NULL)
  ),
  CONSTRAINT message_attachments_video_fields CHECK (
    attachment_type <> 'video' OR (bunny_video_guid IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_workspace ON public.message_attachments(workspace_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: an attachment is visible/insertable exactly when the user is a participant of the parent
-- message — derive from messages (whose own RLS is participant-based). This avoids duplicating the
-- email-match logic and inherits the proven gate.

-- SELECT: visible if you can see the parent message (you are sender or recipient).
DROP POLICY IF EXISTS "message_attachments_select_participant" ON public.message_attachments;
CREATE POLICY "message_attachments_select_participant" ON public.message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  );

-- INSERT: you must be the sender of the parent message, the uploader must be you, and the
-- workspace must match the message's workspace + current_workspace_id() (defense in depth,
-- mirrors messages_insert_sender_workspace).
DROP POLICY IF EXISTS "message_attachments_insert_sender" ON public.message_attachments;
CREATE POLICY "message_attachments_insert_sender" ON public.message_attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND m.sender_id = auth.uid()
        AND m.workspace_id = message_attachments.workspace_id
    )
  );

-- UPDATE: only the uploader (e.g. to flip processing_status / set thumbnail after Bunny encodes).
-- In practice the server does this via the service role; this policy is the user-facing fallback.
DROP POLICY IF EXISTS "message_attachments_update_uploader" ON public.message_attachments;
CREATE POLICY "message_attachments_update_uploader" ON public.message_attachments
  FOR UPDATE USING (uploaded_by = auth.uid() AND workspace_id = public.current_workspace_id())
  WITH CHECK (uploaded_by = auth.uid() AND workspace_id = public.current_workspace_id());

-- DELETE: uploader may remove their own attachment (cascade also handles message deletion).
DROP POLICY IF EXISTS "message_attachments_delete_uploader" ON public.message_attachments;
CREATE POLICY "message_attachments_delete_uploader" ON public.message_attachments
  FOR DELETE USING (uploaded_by = auth.uid() AND workspace_id = public.current_workspace_id());

NOTIFY pgrst, 'reload schema';
```

### 4.1 `messages.message_type` value
Add `'media'` as a recognized type (no DB change needed — `message_type` is a free `TEXT DEFAULT
'text'`; the enum is enforced only in `sendMessageSchema`). Extend that zod enum to include `'media'`.
A media message may also carry a normal text caption in `content` (empty string allowed for image/video-
only). The renderer treats `message_type='media'` → look up its `message_attachments` rows.

### 4.2 Storage bucket (PROPOSED, in the same or a sibling migration)
```sql
-- PRIVATE bucket — matches the post-2026-06-11 security posture (no public listing; signed URLs only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,                                   -- PRIVATE
  10485760,                                -- 10 MB hard cap per image object
  ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No public SELECT policy (private bucket). Object access is via service-role createSignedUrl only.
-- Uploads go through the server (service role) after auth + participant check, so NO client-side
-- storage.objects INSERT policy is granted (least privilege — clients never write storage directly).
-- (If a future direct-upload path is wanted, add a path-scoped authenticated INSERT policy mirroring
--  avatars_authenticated_insert_own_paths, keyed on '<workspace_id>/...'.)
```

`message-attachments` must be **added to the signable allow-list** in `lib/storage-signing.ts`
(`SIGNABLE_BUCKETS`) so the existing `signSupabaseStorageUrl` mints short-lived URLs for it.

---

## 5. Upload + send flow

### 5.1 Image (server-proxied upload → Supabase private bucket)
1. Composer: user picks an image (file input, `accept="image/png,image/jpeg,image/webp,image/gif"`).
   Client-side guard: reject > **10 MB** and non-image MIME before upload (UX; server re-checks).
2. `POST /api/messages/attachments/image` (NEW, `requireCoach`/`requireClient` — actually a shared
   participant check like `app/api/messages/route.ts` uses: load the `clients` row, verify the caller is
   coach-in-workspace OR the matching client). Body = multipart form (the image) + `clientId`.
   - Server validates auth + participant + MIME (sniff magic bytes, not just declared type) + size.
   - Uploads via **service role** to `message-attachments/<workspace_id>/<clientId>/<uuid>.<ext>`
     (`createServiceClient().storage.from('message-attachments').upload(...)`).
   - Returns `{ storagePath, mimeType, fileSizeBytes }` (NOT a public URL — bucket is private).
3. Composer then calls the **send** endpoint (below) with the attachment descriptor; the message + the
   `message_attachments` row are created together server-side.

### 5.2 Video (direct browser → Bunny TUS, mirroring Promote)
1. Composer: user picks a video (`accept="video/mp4,video/quicktime,video/webm"`), client guard rejects
   > **100 MB** (matches `assignment-submissions` cap) and over a **~2 min** duration (read via a hidden
   `<video>` element before upload — short-video intent).
2. `POST /api/messages/attachments/video/create` (NEW — clone of
   `app/api/coach/promote/bunny/create/route.ts`): auth + participant check, optional storage-cap check
   (`checkStorageLimit`), `createBunnyVideo(title)`, returns TUS creds + does NOT yet create the message.
3. Browser uploads to Bunny via TUS (existing client uploader util used by Promote).
4. Composer calls **send** with `{ bunnyVideoGuid, bunnyLibraryId }`; status polling reuses the existing
   `app/api/coach/promote/bunny/status/route.ts` pattern (or a small `message_attachments`-scoped status
   route) to flip `processing_status` → `ready` + set `thumbnail_url`/`duration_seconds` from
   `getBunnyVideo()`.

### 5.3 Send (atomic message + attachment)
Extend `POST /api/messages` (or add `POST /api/messages/with-attachment`) to accept an optional
`attachment` object:
```ts
// sendMessageSchema (extended) — lib/validations.ts
attachment: z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), storagePath: z.string().min(1), mimeType: z.string(),
             fileSizeBytes: z.number().int().positive(), width: z.number().int().optional(),
             height: z.number().int().optional() }),
  z.object({ type: z.literal('video'), bunnyVideoGuid: z.string().min(1), bunnyLibraryId: z.string().min(1) }),
]).optional(),
// content becomes optional/empty-allowed when an attachment is present.
```
Server: insert the `messages` row (`message_type='media'`, content = caption or `''`), then insert the
`message_attachments` row (same `workspace_id`, `message_id`, `uploaded_by=user.id`). Validate the
`storagePath` is under `<workspace_id>/...` (prevent a client from referencing another workspace's
object). Both inserts in sequence; on attachment-insert failure, delete the just-created message (or use
a single RPC for atomicity — optional). Reuse `notifyCoachOfMessage` for the coach-notify path.

### 5.4 Storage accounting
- **Video attachments** set `file_size_bytes`/Bunny size and SHOULD count toward the plan video meter
  (call `checkStorageLimit(..., 'video')` in the create route, exactly like Promote). The existing
  `recalc_workspace_storage` only sums `videos` + `assignment_submissions`; message videos live in
  Bunny under `message_attachments`, so either (a) also create a hidden `videos` row (heavier) or
  (b) extend `recalc_workspace_storage` to add `message_attachments` video sizes (cleaner, **chosen** —
  a follow-up migration once the table exists). For v1 we can enforce the cap at upload time without
  changing the meter, and reconcile later.
- **Image attachments**: not metered in v1 (10 MB cap × low volume). Note for later.

---

## 6. Rendering

In `components/messages/MessagesThreadMessagesList.tsx`, add a branch for `message_type === 'media'`
(before the plain-text fallback). The thread fetch (`GET /api/messages`) must also return each message's
attachments — extend the select to join/fetch `message_attachments` (one extra query keyed by the page's
`message_id`s, or a Postgres embedded select) and **sign image URLs server-side** with
`signSupabaseStorageUrl` (TTL ~1h) so the browser receives a ready-to-load signed URL; videos return
`bunnyEmbedUrl(guid, libraryId)` for the iframe.

UI:
- **Image:** rounded thumbnail in the bubble (cap ~240px, use `width/height` to reserve space), click →
  lightbox (reuse any existing modal/overlay; otherwise a minimal one). Signed URL refresh on expiry:
  re-fetch the thread (URLs are short-lived; thread refresh re-signs).
- **Video:** if `processing_status='ready'`, embed the Bunny iframe (same component Library/Promote uses,
  `iframe.mediadelivery.net`); else a "Processing…" placeholder with the thumbnail. CSP already permits
  the Bunny frame/media/img sources (verified in the video-playback-fix work) — no CSP change expected;
  confirm `message-attachments` signed Supabase URLs (`*.supabase.co/storage/v1/object/sign/...`) are
  allowed by `img-src` (Supabase storage host is already used for avatars).

Composer (`MessagesPageContent.tsx` + `ClientMessagesContent.tsx`): add an attach button (paperclip /
image icon) next to the textarea (~L567 coach), an upload-in-progress chip with a remove (×), and disable
Send only when there's neither text nor a (finished) attachment.

---

## 7. Size / type limits (enforced both client + server)

| | Images | Video |
|---|---|---|
| MIME allow-list | `image/jpeg, image/png, image/webp, image/gif` | `video/mp4, video/quicktime, video/webm` |
| Max size | **10 MB** (bucket `file_size_limit` + server + client check) | **100 MB** (client + Bunny; matches `assignment-submissions`) |
| Max duration | n/a | **~120 s** (client-side read before upload; soft guard) |
| Per message | 1 in v1 (schema supports many) | 1 in v1 |
| Rate limit | reuse `messages-send` (60/min) + a tighter `message-attach:<userId>` (e.g. 20/min) on the upload routes | same |

Server MUST re-validate type (magic-byte sniff for images) and size — never trust the client or the
declared MIME. The Supabase bucket `allowed_mime_types` + `file_size_limit` is a hard backstop for
images; Bunny enforces its own limits for video.

---

## 8. Security

- **Isolation:** `message_attachments` RLS derives visibility from `messages` participant RLS (sender or
  recipient only) and pins `workspace_id`. No cross-workspace read; no anonymous access.
- **Private bucket + signed URLs:** `message-attachments` is **private** (no public SELECT policy),
  consistent with the 2026-06-11 hardening that dropped public-listing policies and the
  `assignment-submissions` privatization. Images are served only via short-lived `createSignedUrl`
  (TTL ~1h) minted by the server (`signSupabaseStorageUrl`, after adding the bucket to
  `SIGNABLE_BUCKETS`). No anonymous enumeration possible.
- **No client-side storage writes:** uploads are server-proxied via the service role after an explicit
  participant check, so we grant **no** `storage.objects` INSERT policy to clients (least privilege).
- **Bunny key safety:** video uses the existing TUS flow — the Stream API key never reaches the browser
  (`createBunnyVideo` runs server-side; only short-lived TUS signature goes out), identical to Promote.
- **Path scoping:** stored at `<workspace_id>/<clientId>/<uuid>.<ext>`; the send endpoint validates the
  submitted `storagePath` begins with the caller's `workspace_id` so a client can't attach another
  tenant's object by guessing a path.
- **Input hygiene:** MIME sniff + size cap server-side; filename is never trusted (we generate a UUID
  name + extension from the validated MIME). Caption goes through the same 2000-char slice as text.
- **Deletion:** `ON DELETE CASCADE` from `messages` removes attachment rows; a cleanup job (or the
  delete route) should also delete the Supabase object / Bunny video to avoid orphaned storage cost
  (best-effort, like `deleteBunnyVideo`). Track as a follow-up if not in v1.

---

## 9. Code touch-points (summary)

**New files**
- `app/api/messages/attachments/image/route.ts` — server-proxied image upload to private bucket.
- `app/api/messages/attachments/video/create/route.ts` — Bunny TUS create (clone of Promote create).
- `app/api/messages/attachments/video/status/route.ts` — (optional) poll Bunny → flip `processing_status`.
- (optional) `app/api/messages/with-attachment/route.ts` — or extend existing `POST /api/messages`.
- `components/messages/MessageAttachment.tsx` — image thumbnail/lightbox + Bunny iframe wrapper.

**Edited files**
- `lib/validations.ts` — extend `sendMessageSchema` (`'media'` type + `attachment` union; content optional).
- `app/api/messages/route.ts` — accept `attachment`; create `message_attachments`; on GET, fetch + sign attachments.
- `components/messages/MessagesThreadMessagesList.tsx` — `message_type==='media'` render branch.
- `app/coach/messages/MessagesPageContent.tsx` + `app/client/(main)/messages/ClientMessagesContent.tsx`
  — attach button, upload UI, send-with-attachment wiring.
- `lib/storage-signing.ts` — add `'message-attachments'` to `SIGNABLE_BUCKETS`.
- `lib/messages/insert-thread-message.ts` — (optional) attachment-aware variant for automated sends.
- (later) `recalc_workspace_storage` migration — include message-attachment video bytes.

**Migration (PROPOSED)**
- `20260616000500_message_attachments.sql` — table + RLS + private `message-attachments` bucket (above).

**Env:** none new (reuses Bunny + Supabase + existing config).

---

## 10. Phased rollout

**Phase 1 — Images (smaller, self-contained)**
Migration (table + bucket) → add bucket to `SIGNABLE_BUCKETS` → image upload route → extend send + GET
(sign URLs) → render branch + composer attach (image only). Ships the most-used case fast.

**Phase 2 — Video**
Bunny create/status routes (clone Promote) → composer video picker + TUS upload + processing placeholder
→ Bunny iframe render. Reuses Phase-1 send/render plumbing.

**Phase 3 — Polish/hardening**
Storage-meter reconciliation for message videos, orphaned-object cleanup on delete, optional multi-
attachment, CSP re-verify at 375px + desktop.

Each phase: `tsc` + `next build` green; apply migration to a **non-prod** DB first; owner applies to prod
after review (project rule). Verify a real coach↔client exchange (image + short clip) renders for both
parties and is invisible to a third workspace.

---

## 11. Risks & mitigations

- **Cross-tenant leakage:** mitigated by deriving RLS from `messages` participant gate + workspace pin +
  private bucket + server-minted signed URLs + path scoping. Verify with the standard isolation test
  (a second workspace cannot SELECT the row or fetch the object).
- **Signed-URL expiry mid-view:** images use ~1h TTL; a thread refresh re-signs. Acceptable; document.
- **Storage cost (video):** enforce the 100 MB + ~2 min caps at upload; count video bytes toward the plan
  meter (Phase 1 enforces at upload, Phase 3 reconciles the meter). Cleanup on delete prevents orphans.
- **Bunny not configured:** the video create route returns the same 503 as Promote (`bunnyConfigured()`),
  and the composer hides the video option — images still work.
- **CSP:** Bunny frame/media + Supabase storage img sources are already allowed (video-playback-fix +
  avatars); re-verify the signed-Supabase host is covered by `img-src`. No expected change, but confirm
  before ship.
- **Realtime payload:** `messages` realtime already fires; attachments are a separate table, so the live
  insert delivers the message immediately and the client fetches/sign-loads attachments on render (or we
  include them in the realtime handler's follow-up fetch). No realtime schema change required.
- **Backward compatibility:** purely additive — existing text/card messages have no `message_attachments`
  rows and render unchanged; `message_type` stays a free TEXT (only the zod enum widens).

---

## 12. Open questions for owner
1. **One vs many** attachments per message in v1 — spec assumes **one** (schema already supports many).
2. **Image storage metering** — leave images unmetered in v1 (assumed), or count them too?
3. **Who can attach video** — both coach and client, or coach-only first? (spec allows both; the create
   route's participant check supports either).
4. **Retention/cleanup** — delete the Bunny video / Supabase object when a message is deleted in v1, or
   defer the cleanup job to Phase 3? (spec defers, flags the orphan-cost risk).
