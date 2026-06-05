# Promote + Library Redesign — Morning Handoff

**Built overnight 2026-06-05 → 06.** Branch `rebuild/v2`. **Not deployed.** Build green, smoke-tested, zero page errors.

---

## ⛔ Your ONE required action (10 seconds): apply the migration

The Supabase MCP turned out **read-only** (the memory predicted this), so I couldn't apply it overnight even though you approved it. It's **staged** — apply this one additive file:

```
supabase/migrations/20260605000000_promote_posts_and_profile.sql
```

- **Easiest:** Supabase dashboard → **SQL Editor** → paste the file's contents → **Run**.
- It's **additive only**: two new tables (`promote_posts`, `promote_profile`) + workspace-scoped RLS. **Nothing on existing tables is touched.**
- Until it's applied, Promote still **works** (generates + lets you edit posts) but shows *"Could not sync to your shelf"* instead of saving. The instant you apply it, **Saved Posts + Brand Voice go live**.

Then run the advisor to confirm RLS is happy: it should report no new issues.

---

## What shipped (4 commits on `rebuild/v2`)

| Commit | What |
|---|---|
| `71ea7dc` | Design spec (`docs/superpowers/specs/2026-06-05-promote-library-redesign-design.md`) |
| `827d8cf` | **Data + API layer:** `promote_posts` + `promote_profile` migration; `/api/coach/promote/posts` (list/create), `/posts/[id]` (patch/delete), `/profile` (get/upsert); platform/booking-link/sign-off threaded into generation; **fix** — `PATCH /api/videos/[id]` now writes `category_id` |
| `39c04d5` | **Library:** search + sort, "Use in Promote" on each card, single-edit category picker (writes `category_id`), always-visible ⋯ menu, mobile header overflow menu, hidden redundant "Uncategorized" tab, storage-bar min fill, crimson→brass, gradient empty-thumbnail |
| `ae0ec13` | **Promote → content workspace:** auto-saved **Saved Posts** shelf (revisit/copy/mark-posted/delete), **inline-editable** output, **Brand Voice** persisted per workspace, **platform toggle** (IG/FB), `?video=` deep-link preselect, chat starter prompts, labeled "OR" divider, unified step label |

## The two audit findings I overruled (and why)
- **"Promote cards don't stack on mobile" → FALSE POSITIVE.** The code was already `grid sm:grid-cols-3`. Verified at a real 375px viewport — they stack. Screenshot: `screenshots/verify-promote-375.png`.
- **"No way to manage a video from the grid" → FALSE POSITIVE.** The ⋯ menu existed but was hover-only (invisible on touch). I made it always-visible instead of "adding" a menu. Screenshot: `screenshots/verify-videos-375.png`.

## Verified tonight (local dev server, demo coach, no page errors)
Smoke test: `screenshots/verify-redesign.py`. Screenshots: `screenshots/verify-*.png`.
- ✅ Library: search, sort, mobile header (Upload + ⋯), hidden Uncategorized tab, always-visible kebab, gradient placeholders, storage min-fill.
- ✅ Promote: page renders, Saved-posts button, mobile cards stack, **generation works**, **inline edit → 3 editable textareas**, graceful "could not sync" until migration applied.
- ⏳ **Not yet live-testable** (needs the migration): Saved Posts persistence, Brand Voice save. Code compiles + is wired; expected to work the moment the table exists.

## Deploy (after the migration is applied + you've eyeballed it)
```
npx --yes vercel --prod
```
Repo is linked (project `sensei-app`); `.vercelignore` keeps the upload ~5 MB. Verify on `coach.foundos.ai`.

## Deferred (spec written, NO code — your call later)
- **Multi-clip video editor:** `docs/superpowers/specs/2026-06-05-multiclip-video-editor-design.md` (recommends extending the existing Remotion/Lambda stack with a `<Series>` timeline composition; flags a `video_projects` table for your approval).
- **Library folders** (you chose to defer — categories + search first).
- **Stretch, not built:** rename-on-upload + auto-title from the Bunny transcript; custom/pick-a-frame thumbnail. Both are no-schema and ready to pick up next.

## Notes
- No new npm packages. No changes to existing tables/RLS. All reversible.
- `booking_url` + `signature` are the coach's own data, length-bounded + http(s)-validated + sanitized before they touch the AI prompt.
