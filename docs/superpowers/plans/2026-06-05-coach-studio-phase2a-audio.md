# Coach Studio — Phase 2a (Audio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add audio to the Studio editor: upload a music track, record a voiceover in the browser, balance the three layers (clip sound / music / voiceover) with sliders, and bake them into the rendered MP4.

**Architecture:** Extends Phase 1. Audio files go to a new **public** Supabase Storage bucket `studio-audio` (server-proxy upload + magic-byte validation, matching the repo's existing upload routes). The `video_projects.audio` JSONB stores workspace-prefixed **paths** (validated server-side; no new table). The `TimelineVideo` Remotion composition gains `<Audio>` layers for music + voiceover and a per-clip `volume` on each `<OffthreadVideo>`. The render route resolves audio paths → public URLs server-side.

**Tech Stack:** Next.js 16, TypeScript, Supabase Storage, Remotion 4.0.468 (`<Audio>`), browser `MediaRecorder`. **No new npm packages.**

**Spec:** `docs/superpowers/specs/2026-06-05-coach-studio-design.md` (Phase 2 audio scope). Builds on `docs/superpowers/plans/2026-06-05-coach-studio-phase1-editor-core.md`.

---

## Testing approach (same as Phase 1)
Pure logic → TDD via `npx tsx scripts/_studio-check2.ts`. Routes → `npx tsc --noEmit` + unauth `curl` probe (expect 401). UI/composition → `next build` + browser smoke. Stop any dev server before `npm run build` (Windows `.next`). Commit after each task. Branch: `rebuild/v2`.

## ⚠️ Owner prerequisite
Apply the staged migration from Task 1 (`supabase/migrations/20260605020000_studio_audio_bucket.sql`) in the Supabase SQL editor (MCP read-only). Until applied, audio upload returns an error but the rest of the editor works. (No Lambda redeploy needed for Task changes here EXCEPT Task 4, which edits the `TimelineVideo` composition → the Lambda site must be re-deployed again, same command as Phase 1: `npx remotion lambda sites create remotion/index.ts --site-name=kindo-captioned`.)

## File structure
**Created:** `supabase/migrations/20260605020000_studio_audio_bucket.sql`; `app/api/studio/audio/route.ts`; `app/coach/studio/AudioPanel.tsx`; `scripts/_studio-check2.ts` (throwaway).
**Modified:** `lib/studio/timeline.ts` (ProjectAudioSchema → paths + a resolver helper); `lib/file-validation.ts` (add `validateAudioMagicBytes`); `remotion/TimelineVideo.tsx` (+`<Audio>` + clip volume); `lib/remotion.ts` (`TimelineRenderInput.audio`); `app/api/studio/render/route.ts` (resolve audio); `app/coach/studio/StudioEditor.tsx` (mount `AudioPanel` + persist `audio`).

---

## Task 1: Staged migration — `studio-audio` bucket

**Files:** Create `supabase/migrations/20260605020000_studio_audio_bucket.sql`

- [ ] **Step 1: Write the migration** (mirrors the `assignment-submissions` bucket pattern: public bucket + public SELECT policy; uploads use the service client so no INSERT policy is required)

```sql
-- Coach Studio Phase 2a: audio bucket for uploaded music + recorded voiceovers.
-- Public bucket (matches the existing 'videos'/'assignment-submissions' media buckets) so the
-- Remotion Lambda renderer + the editor can fetch via getPublicUrl. Paths are workspace-prefixed
-- and validated server-side. Uploads go through the service-role client (RLS bypass), so only a
-- public SELECT policy is needed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-audio', 'studio-audio', true, 26214400,
  ARRAY['audio/mpeg'::text, 'audio/mp3'::text, 'audio/wav'::text, 'audio/x-wav'::text,
        'audio/ogg'::text, 'audio/webm'::text, 'audio/mp4'::text, 'audio/aac'::text, 'audio/m4a'::text])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "studio_audio_public_select" ON storage.objects;
CREATE POLICY "studio_audio_public_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'studio-audio');
```
(25 MB cap = `26214400`.)

- [ ] **Step 2: Commit (staged — owner applies)**
```bash
git add supabase/migrations/20260605020000_studio_audio_bucket.sql
git commit -m "feat(studio): staged migration — studio-audio storage bucket"
```

- [ ] **Step 3: Owner applies + verify** (read-only after they run it):
```sql
select id, public, file_size_limit from storage.buckets where id='studio-audio';
```
Expected: one row, `public=true`, `file_size_limit=26214400`.

---

## Task 2: Audio schema (paths) + magic-byte validator

**Files:** Modify `lib/studio/timeline.ts`, `lib/file-validation.ts`; Test `scripts/_studio-check2.ts`

- [ ] **Step 1: Write the failing checks** `scripts/_studio-check2.ts`
```ts
import assert from 'node:assert'
import { ProjectAudioSchema, audioPublicPath } from '../lib/studio/timeline'
import { validateAudioMagicBytes } from '../lib/file-validation'

// New shape: music/voiceover are storage PATHS (string|null), not UUIDs
const a = ProjectAudioSchema.parse({ music: 'ws1/abc.mp3', voiceover: null, volumes: { clip: 1, music: 0.4, voiceover: 1 } })
assert.strictEqual(a.music, 'ws1/abc.mp3', 'music path kept')
assert.strictEqual(a.voiceover, null, 'voiceover null ok')
assert.ok(ProjectAudioSchema.safeParse({}).success, 'empty audio defaults ok')
// volume out of range rejected
assert.ok(!ProjectAudioSchema.safeParse({ volumes: { clip: 2, music: 0, voiceover: 0 } }).success, 'volume>1 rejected')
// path must be workspace-prefixed (helper enforces tenant isolation)
assert.strictEqual(audioPublicPath('ws1', 'ws1/abc.mp3'), 'ws1/abc.mp3', 'in-workspace path ok')
assert.strictEqual(audioPublicPath('ws1', 'ws2/abc.mp3'), null, 'cross-workspace path rejected')
assert.strictEqual(audioPublicPath('ws1', null), null, 'null path ok')

// magic bytes: a fake MP3 (ID3) passes, random bytes fail
assert.strictEqual(validateAudioMagicBytes(Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00])), true, 'ID3 mp3 ok')
assert.strictEqual(validateAudioMagicBytes(Buffer.from([0x00, 0x01, 0x02, 0x03])), false, 'garbage rejected')
console.log('OK studio audio schema + validation')
```

- [ ] **Step 2: Run → fails** `npx tsx scripts/_studio-check2.ts` → FAIL (exports missing).

- [ ] **Step 3: Replace `ProjectAudioSchema` in `lib/studio/timeline.ts`** (it currently uses `musicAssetId`/`voiceoverAssetId` UUIDs — change to paths; nothing reads the old shape yet) and add the resolver:
```ts
export const ProjectAudioSchema = z.object({
  music: z.string().max(300).nullable().default(null),       // storage path in studio-audio, workspace-prefixed
  voiceover: z.string().max(300).nullable().default(null),   // storage path
  volumes: z.object({
    clip: z.number().min(0).max(1).default(1),
    music: z.number().min(0).max(1).default(0.5),
    voiceover: z.number().min(0).max(1).default(1),
  }).default({ clip: 1, music: 0.5, voiceover: 1 }),
}).default(() => ({ music: null, voiceover: null, volumes: { clip: 1, music: 0.5, voiceover: 1 } }))
export type ProjectAudio = z.infer<typeof ProjectAudioSchema>

// Tenant guard: only return a path that belongs to this workspace (paths are `${workspaceId}/...`).
export function audioPublicPath(workspaceId: string, path: string | null): string | null {
  if (!path) return null
  return path.startsWith(`${workspaceId}/`) ? path : null
}
export const STUDIO_AUDIO_BUCKET = 'studio-audio'
```

- [ ] **Step 4: Add `validateAudioMagicBytes` to `lib/file-validation.ts`** (match the existing `validateVideoMagicBytes`/`validateImageMagicBytes` style there — read the file first). Implementation:
```ts
// Accept common audio containers: MP3 (ID3 or frame sync), WAV (RIFF/WAVE), OGG, FLAC,
// and MP4/M4A/WebM (MediaRecorder output is audio/webm in Chrome, audio/mp4 in Safari).
export function validateAudioMagicBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false
  const b = buf
  const ascii = (s: number, n: number) => buf.toString('ascii', s, s + n)
  if (ascii(0, 3) === 'ID3') return true                                  // MP3 w/ ID3
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true                // MP3 frame sync
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return true       // WAV
  if (ascii(0, 4) === 'OggS') return true                                 // OGG
  if (ascii(0, 4) === 'fLaC') return true                                 // FLAC
  if (ascii(4, 4) === 'ftyp') return true                                 // MP4 / M4A
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return true // WebM/Matroska (EBML)
  return false
}
```

- [ ] **Step 5: Run → passes** `npx tsx scripts/_studio-check2.ts` → `OK studio audio schema + validation`. Also `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**
```bash
git add lib/studio/timeline.ts lib/file-validation.ts scripts/_studio-check2.ts
git commit -m "feat(studio): audio schema (paths) + audio magic-byte validation"
```

---

## Task 3: Audio upload route

**Files:** Create `app/api/studio/audio/route.ts`

Read `app/api/client/videos/upload/route.ts` first to match the multipart + service-upload + magic-byte pattern exactly.

- [ ] **Step 1: Implement** `app/api/studio/audio/route.ts`
```ts
import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { validateAudioMagicBytes } from '@/lib/file-validation'
import { STUDIO_AUDIO_BUCKET } from '@/lib/studio/timeline'
import { logServerError } from '@/lib/log-server-error'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const MAX_BYTES = 25 * 1024 * 1024
const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/m4a': 'm4a' }

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth

  const rate = await checkRateLimitAsync(`studio-audio:${user.id}`, { windowMs: 60_000, max: 20, failMode: 'open' })
  if (!rate.success) return NextResponse.json({ error: 'Too many uploads — wait a moment.' }, { status: 429 })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'Invalid upload' }, { status: 400 }) }
  const kind = String(form.get('kind') ?? '')
  if (kind !== 'music' && kind !== 'voiceover') return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Audio too large (max 25MB)' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  if (!validateAudioMagicBytes(buf)) return NextResponse.json({ error: 'Not a valid audio file' }, { status: 400 })

  const mime = file.type && EXT[file.type] ? file.type : 'audio/mpeg'
  const ext = EXT[mime] ?? 'mp3'
  const path = `${workspaceId}/${kind}-${randomUUID()}.${ext}`

  try {
    const service = createServiceClient()
    const { error } = await service.storage.from(STUDIO_AUDIO_BUCKET).upload(path, buf, { contentType: mime, upsert: false })
    if (error) throw error
    const { data: pub } = service.storage.from(STUDIO_AUDIO_BUCKET).getPublicUrl(path)
    return NextResponse.json({ data: { path, url: pub.publicUrl } }, { status: 201 })
  } catch (err) {
    await logServerError('POST /api/studio/audio', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean; with dev running `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/studio/audio` → `401`.

- [ ] **Step 3: Commit**
```bash
git add app/api/studio/audio/route.ts
git commit -m "feat(studio): audio upload route (validate + store in studio-audio)"
```

---

## Task 4: Render-side audio — composition + lib + route

**Files:** Modify `remotion/TimelineVideo.tsx`, `lib/remotion.ts`, `app/api/studio/render/route.ts`

- [ ] **Step 1: Extend `TimelineVideo.tsx`** — add audio to props + render `<Audio>` layers + per-clip volume. Add `Audio` to the remotion import; extend `TimelineVideoProps`:
```tsx
// import: add Audio
import { AbsoluteFill, Audio, OffthreadVideo, Series, useCurrentFrame, useVideoConfig } from 'remotion'

// extend props type:
export type TimelineAudio = { musicUrl: string | null; voiceoverUrl: string | null; volumes: { clip: number; music: number; voiceover: number } }
export type TimelineVideoProps = {
  clips: TimelineRenderClip[]
  captions: TimelineCaption[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
  audio?: TimelineAudio
}
```
In the component, default audio and apply it:
```tsx
export function TimelineVideo({ clips, captions, captionStyle, audio }: TimelineVideoProps) {
  const vol = audio?.volumes ?? { clip: 1, music: 0.5, voiceover: 1 }
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Series>
        {clips.map((clip, i) => {
          const durationInFrames = Math.max(1, Math.round((clip.outSec - clip.inSec) * 30))
          return (
            <Series.Sequence key={i} durationInFrames={durationInFrames}>
              <AbsoluteFill>
                <OffthreadVideo src={clip.mp4Url} trimBefore={Math.round(clip.inSec * 30)} trimAfter={Math.round(clip.outSec * 30)} volume={vol.clip} style={coverStyle(clip.crop)} />
              </AbsoluteFill>
            </Series.Sequence>
          )
        })}
      </Series>
      {audio?.musicUrl ? <Audio src={audio.musicUrl} volume={vol.music} /> : null}
      {audio?.voiceoverUrl ? <Audio src={audio.voiceoverUrl} volume={vol.voiceover} /> : null}
      <CaptionLayer captions={captions} captionStyle={captionStyle} />
    </AbsoluteFill>
  )
}
```
(`<Audio>` with no trim plays from 0 and is auto-trimmed to the composition duration — fine for Phase 2a; looping is a later nicety.)

- [ ] **Step 2: Extend `TimelineRenderInput` in `lib/remotion.ts`** — add the optional `audio` field so it flows to `inputProps`:
```ts
export type TimelineRenderInput = {
  clips: { mp4Url: string; inSec: number; outSec: number; crop: { x: number; y: number; w: number; h: number } | null; captionsOn: boolean }[]
  captions: { text: string; startMs: number; endMs: number }[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
  audio?: { musicUrl: string | null; voiceoverUrl: string | null; volumes: { clip: number; music: number; voiceover: number } }
}
```
No other change to `startTimelineRender` (it already passes the whole input as `inputProps`).

- [ ] **Step 3: Resolve audio in `app/api/studio/render/route.ts`** — after loading the project (which already selects `timeline, caption_style`), also select `audio`, validate the paths to this workspace, build public URLs, and pass to `startTimelineRender`. Read the current route first. Changes:
  - Add `audio` to the project `.select(...)`: `.select('id, timeline, caption_style, audio')`.
  - Add imports: `import { ProjectAudioSchema, audioPublicPath, STUDIO_AUDIO_BUCKET } from '@/lib/studio/timeline'` (TimelineSchema etc. already imported).
  - Inside the `after()` callback, before calling `startTimelineRender`, build the audio input:
```ts
const pa = ProjectAudioSchema.safeParse(project.audio)
let audioInput: TimelineRenderInput['audio'] = undefined
if (pa.success) {
  const musicPath = audioPublicPath(workspaceId, pa.data.music)
  const voPath = audioPublicPath(workspaceId, pa.data.voiceover)
  const pub = (p: string | null) => p ? service.storage.from(STUDIO_AUDIO_BUCKET).getPublicUrl(p).data.publicUrl : null
  audioInput = { musicUrl: pub(musicPath), voiceoverUrl: pub(voPath), volumes: pa.data.volumes }
}
const { renderId, bucketName } = await startTimelineRender({ clips: renderClips, captions, captionStyle: project.caption_style as TimelineRenderInput['captionStyle'], audio: audioInput })
```
(`service` is already in scope in the route. The clip-audio volume is carried inside `audioInput.volumes.clip` and applied by the composition.)

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean. `npx remotion compositions remotion/index.ts` still lists `TimelineVideo` (composition compiles with the new `<Audio>` + props).

- [ ] **Step 5: Commit**
```bash
git add remotion/TimelineVideo.tsx lib/remotion.ts app/api/studio/render/route.ts
git commit -m "feat(studio): render music + voiceover + per-clip volume into the reel"
```
- [ ] **Step 6: Owner infra** — re-deploy the Lambda site (composition changed): `npx remotion lambda sites create remotion/index.ts --site-name=kindo-captioned`.

---

## Task 5: Editor audio UI — `AudioPanel` + wire into `StudioEditor`

**Files:** Create `app/coach/studio/AudioPanel.tsx`; Modify `app/coach/studio/StudioEditor.tsx`

- [ ] **Step 1: Create `app/coach/studio/AudioPanel.tsx`** — a client component owning music upload, in-browser voiceover recording (`MediaRecorder`), and the 3 volume sliders. It's controlled: parent passes the current `audio` + an `onChange`.
```tsx
'use client'
import { useRef, useState } from 'react'
import type { ProjectAudio } from '@/lib/studio/timeline'

async function uploadAudio(kind: 'music' | 'voiceover', file: Blob): Promise<string> {
  const fd = new FormData()
  fd.append('kind', kind)
  fd.append('file', file, kind === 'music' ? 'music' : 'voiceover.webm')
  const res = await fetch('/api/studio/audio', { method: 'POST', credentials: 'include', body: fd })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Upload failed')
  return j.data.path as string
}

export function AudioPanel({ audio, onChange }: { audio: ProjectAudio; onChange: (a: ProjectAudio) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const setVol = (k: 'clip' | 'music' | 'voiceover', v: number) => onChange({ ...audio, volumes: { ...audio.volumes, [k]: v } })

  async function onMusic(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setErr(null); setBusy('music')
    try { onChange({ ...audio, music: await uploadAudio('music', f) }) } catch (x) { setErr(x instanceof Error ? x.message : 'Upload failed') } finally { setBusy(null) }
  }
  async function startRec() {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setBusy('voiceover')
        try { onChange({ ...audio, voiceover: await uploadAudio('voiceover', blob) }) } catch (x) { setErr(x instanceof Error ? x.message : 'Upload failed') } finally { setBusy(null) }
      }
      recRef.current = rec; rec.start(); setRecording(true)
    } catch { setErr('Microphone access denied') }
  }
  function stopRec() { recRef.current?.stop(); setRecording(false) }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="text-sm font-medium">Audio</div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5">
          {audio.music ? 'Replace music' : 'Add music'}
          <input type="file" accept="audio/*" className="hidden" onChange={onMusic} disabled={busy === 'music'} />
        </label>
        {audio.music && <button onClick={() => onChange({ ...audio, music: null })} className="opacity-60 hover:opacity-100">Remove</button>}
        {busy === 'music' && <span className="opacity-60">Uploading…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {!recording
          ? <button onClick={startRec} className="rounded-lg border border-white/15 px-3 py-1.5">{audio.voiceover ? 'Re-record voiceover' : 'Record voiceover'}</button>
          : <button onClick={stopRec} className="rounded-lg border border-red-500/60 px-3 py-1.5 text-red-300">Stop ●</button>}
        {audio.voiceover && !recording && <button onClick={() => onChange({ ...audio, voiceover: null })} className="opacity-60 hover:opacity-100">Remove</button>}
        {busy === 'voiceover' && <span className="opacity-60">Saving…</span>}
      </div>
      <div className="space-y-2 pt-1">
        {(['clip', 'music', 'voiceover'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-xs">
            <span className="w-20 capitalize opacity-70">{k === 'clip' ? 'Clip sound' : k}</span>
            <input type="range" min={0} max={1} step={0.05} value={audio.volumes[k]} onChange={(e) => setVol(k, Number(e.target.value))} className="flex-1" />
            <span className="w-8 text-right opacity-60">{Math.round(audio.volumes[k] * 100)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `StudioEditor.tsx`.** Read the current file. Add audio state + persist it. Changes:
  - Import: `import { AudioPanel } from './AudioPanel'` and add `ProjectAudioSchema, type ProjectAudio` to the `@/lib/studio/timeline` import.
  - Add state: `const [audio, setAudio] = useState<ProjectAudio>(() => ProjectAudioSchema.parse({}))`.
  - In the load effect, after setting title/captionStyle: `if (p.audio) setAudio(ProjectAudioSchema.parse(p.audio))`.
  - Include audio in the autosave body: in `save`, change the body to `JSON.stringify({ title, timeline: serialize(), captionStyle, audio })` and add `audio` to the `useCallback` deps.
  - Render `<AudioPanel audio={audio} onChange={setAudio} />` in the inspector column (below the caption-style picker).

- [ ] **Step 3: Verify** `npm run build` green. Browser smoke (demo coach, migration applied): open a project → Add music (uploads, shows Replace/Remove) → Record voiceover (mic prompt → record → stop → Saving… → Re-record) → move the 3 sliders → reload page and confirm audio persisted (music filename/voiceover present + slider values). (Actual mixed audio is verified at render time once the Lambda site is redeployed.)

- [ ] **Step 4: Commit**
```bash
git add app/coach/studio/AudioPanel.tsx app/coach/studio/StudioEditor.tsx
git commit -m "feat(studio): editor audio UI — music upload, voiceover record, volume mix"
```

---

## Task 6: Cleanup + build gate

- [ ] **Step 1:** `git rm scripts/_studio-check2.ts && git commit -m "chore(studio): remove phase-2a test harness"`
- [ ] **Step 2:** Stop dev; `npm run build` → green.
- [ ] **Step 3:** Smoke notes for the owner (audio needs: migration applied + Lambda site redeployed before a render mixes audio).

---

## Self-review

- **Music upload** → Tasks 1 (bucket) + 3 (route) + 5 (UI). ✓
- **In-browser voiceover** → Task 5 (`MediaRecorder`) + 3 (same upload route, `kind=voiceover`). ✓
- **3-track volume mix** → Task 5 (sliders → `audio.volumes`) + 4 (composition applies `clip`/`music`/`voiceover` volumes). ✓
- **Persist per workspace** → `video_projects.audio` JSONB (Phase 1 column) + autosave (Task 5). ✓
- **Secure** → workspace-prefixed paths validated by `audioPublicPath` server-side (Task 2/4); magic-byte validation + size cap + rate limit on upload (Task 3); never trust a client URL (render re-derives the public URL from the validated path). ✓
- **No new packages.** Remotion `<Audio>` is core; `MediaRecorder` is a browser API; Supabase Storage is already used. ✓
- **Type consistency:** `ProjectAudio` (`{ music, voiceover, volumes }`) is the single source in `lib/studio/timeline.ts`; `TimelineAudio`/`TimelineRenderInput.audio` use resolved `musicUrl`/`voiceoverUrl` (paths→URLs happen only in the render route). Editor stores paths; composition consumes URLs. No drift.
- **Out of scope (correctly absent):** manual crop UI + live preview = Phase 2b (needs `@remotion/player` approval); music looping/ducking = later.

## Execution
Subagent-driven (autonomous), same as Phase 1. No package approvals needed for Phase 2a. Owner prereqs: apply the Task 1 migration + (after Task 4) redeploy the Lambda site.
