# Promote tab + Schedule + cleanup — build plan (for 8pm)

Goal tonight: ship a **Promote** tab, simplify **Schedule**, kill **Assignments** + **client uploads**.
Everything below is grounded in the actual code (files/lines verified 2026-05-28).

---

## 0. "Connect to his Insta?" — the answer

Three tiers. **Build Tier 1 tonight.** Design so Tier 2 slots in later. Skip Tier 3.

| Tier | What | Effort | Tonight? |
|---|---|---|---|
| **1. Content studio (no API)** | Generate ideas + scripts + captions, attach a library video, **Copy caption → "Open Instagram/Facebook"** (coach posts manually) | Hours | ✅ YES |
| **2. Auto-publish to IG/FB** | Meta Graph API content-publishing. Needs a Facebook app, OAuth, coach's IG = Business acct linked to a FB Page, + **Meta App Review** for `instagram_content_publish` / `pages_manage_posts` (days–weeks) | Days | ❌ v2 |
| **3. Meta / IG Ads** | Marketing API: ad account, billing, campaign objects, business verification | Weeks | ❌ no (and the research says organic content > ads for this ICP) |

Tier 1 is the highest-value piece anyway (the research's whole point: coaches lack *content*, not a publish button). It works regardless of which integration you choose later.

---

## 1. Final coach nav

Add **Promote** (Megaphone icon), remove **Assignments**. Proposed groups:

- **Command Center:** Dashboard · Schedule · Classes
- **Clients:** Clients
- **Grow:** **Promote** (all plans) · Lead research (Pro+)
- **Business:** Programs · Packages · Payments · Videos
- Bottom: Settings

Nav lives in **multiple files** — update all:
- `app/coach/CoachSidebarShell.tsx` (LIVE desktop sidebar — `SECTIONS`) — add Promote, remove Assignments, add Grow group
- `components/layout/CoachMobileDock.tsx` (`MORE_LINKS` L304, `MORE_GRID` L335) — add Promote, remove Assignments
- `components/layout/MobileNav.tsx` (L183) — remove Assignments, add Promote
- `components/layout/coach-sidebar-nav.tsx` (L44) — used by `app/billing/layout.tsx` only; remove Assignments, add Promote for consistency
- `components/layout/Sidebar.tsx` (L288) — drop the `/coach/assignments` badge branch
- `components/layout/GameBar.tsx` (L16) + `CoachNavTrail.tsx` (L20) — remove the Assignments title/breadcrumb entries (add Promote)
- New Megaphone icon: use `lucide-react` `Megaphone` in CoachSidebarShell; add an SVG to `coach-nav-icons.tsx` if the mobile set needs one

---

## 2. Kill Assignments + client uploads (money saver)

**Key fact:** the *only* client file-upload path is `components/client/AssignmentSubmitModal.tsx` (assignment submissions). Scan of `app/client` found no other `<input type=file>`. **Remove assignments → client uploads gone → storage cost down.**

Tonight = **quick hide** (don't delete DB/routes yet):
- Remove all nav entries (section 1)
- Neutralize client route: `app/client/(main)/assignments/page.tsx` → redirect to `/client/portal` (kills reachability of the submit modal)
- Remove the client portal's "Assignments" tab/link (check `app/client/(main)` layout/nav)
- Dashboard: `app/coach/dashboard/CoachDashboardHome.tsx` L122–123 — remove the two "assignments need review / overdue assignments" attention items
- Optional: stop the badge fetch in `Sidebar.tsx` `useCoachSidebarBadges` (`/api/assignments/overview`)

Defer to later (NOT tonight): deleting `app/coach/assignments/*`, `app/api/assignments/*`, assignment components, DB tables, and the `maxAssignment*` fields in `plan-limits.ts`. Leaving them dormant is harmless.

Double-check nothing crashes: `components/shared/AssignmentChatCards.tsx` (assignments shown in messages) just renders data — fine when dormant.

---

## 3. Promote tab (the main build)

**Files to create:**
- `app/coach/promote/page.tsx` (server wrapper, `requireCoach`)
- `app/coach/promote/PromotePageContent.tsx` (client UI)
- `app/api/coach/promote/generate/route.ts` (Claude)

**UI (`PromotePageContent`):**
1. Pick what you're promoting: **Class / Group session** · **Workout or technique** · **Book a 1:1** · **Behind-the-scenes / trust**
2. Inputs: discipline (prefill from workspace), topic/details, tone (Hype / Calm / Friendly)
3. Buttons: **Generate ideas** (5 post angles) · **Write the post** (hook + caption + hashtags + CTA, plus a short **video script / shot list** when relevant)
4. Optional: **Attach a video** picked from the existing library (`/api/videos`) — no new storage cost
5. Output actions: **Copy caption** · **Copy script** · **Open Instagram** / **Open Facebook** (manual post for v1) · (later: Save draft)

**API (`/api/coach/promote/generate`)** — reuse the `lead-research.ts` pattern:
```ts
import Anthropic from '@anthropic-ai/sdk'   // already a dep; ANTHROPIC_API_KEY already set
// requireCoach() + checkRateLimitAsync() (copy from app/api/coach/storage/route.ts)
// model: 'claude-sonnet-4-6' (matches lead-research; pennies for short output)
// body: { kind, discipline, topic?, tone?, mode: 'ideas' | 'post' }
// system: "You write IG/FB posts for a martial-arts/fitness coach. Local, confident, warm.
//          No hype-spam, minimal emoji. Return JSON only."
// mode 'ideas' -> { ideas: [{ title, angle }] }            (5)
// mode 'post'  -> { hook, caption, hashtags: string[], cta, videoScript?: string[] }
```
Return structured JSON; render with copy buttons. **No gating** (content tools = all plans, per the pricing model).

**Storage decision:** stateless for v1 (generate → copy). Add a `promo_drafts` table later if he wants to save/schedule.

---

## 4. Schedule — simplify (mostly already built)

Already exists: week grid (`ScheduleWeekGrid.tsx`), availability, booking, session detail, **and an iCal phone feed** (`lib/build-coach-calendar-ics.ts` + `app/api/calendar/feed/coach/route.ts` + `app/api/coach/calendar-feed-token/route.ts`).

Tonight:
- **"Add to your phone calendar"** button in `CoachScheduleWorkspace.tsx` → fetch the feed token, show the `webcal://…/api/calendar/feed/coach?token=…` URL + a Copy button + Apple/Google instructions. (Backend already done — just surface it.)
- **Month view toggle** (week grid exists; add a simple month grid showing sessions + classes).
- Keep **Classes** as the paid-slot setup; add a "**+ New class**" shortcut from Schedule.

---

## 5. Verify + ship
- `npx tsc --noEmit`
- Browser pass on demo (login button is now **"Sign in"**; overlay bypass: `sessionStorage 'sensei-opening-played'='1'`, `reducedMotion`)
- Commit

---

## Decisions to confirm at 8pm
1. **Insta integration:** Tier 1 manual tonight (recommended) — agree?
2. **Classes:** keep separate (recommended) or merge into Schedule?
3. **Nav trim:** only remove Assignments (recommended) or also hide Programs/Packages/Invoices to slim it down?
4. **Assignments:** quick-hide tonight (recommended) or full delete?
5. **Promo drafts:** stateless v1 (recommended) or save to DB now?

## Rough order / effort
1. Nav + assignments quick-hide — ~45 min
2. Promote API route + prompt — ~45 min
3. Promote UI — ~1.5 hr
4. Schedule "add to phone" + month view — ~1–1.5 hr
5. Verify + commit — ~30 min
