# 🥋 Dojo Arcade — Full-App Reskin (progress report)
*2026-06-10 · branch `design/dojo-arcade` · NOT deployed*

You said: "I want my full app to be the Dojo Arcade." Here's what got built while you were out.

---

## TL;DR

- **The whole app is now Dojo Arcade** — cream canvas, ink-black 3px borders, hard offset shadows, belt-bright color blocks, Space Grotesk + DM Sans. Landing, auth, coach app, and client portal.
- **It builds 100% green** (`next build` + `tsc --noEmit` clean) across ~50 changed files.
- **Landing + login are pixel-verified** on localhost (desktop + mobile screenshots in `screenshots/arcade-*.png`). The rest is build- + code-verified (I couldn't safely pixel-check authed pages without hammering your fragile prod DB).
- **Nothing deployed. Nothing pushed.** Two commits on `design/dojo-arcade` (`2d5de4c` foundation, `8f652a0` surfaces). Your prod + `main` + `rebuild/v2` are untouched.
- **Gamification is honest, not faked.** Real XP + streaks (you already have them in `client_rewards`) are shown; belts/medals/achievements have **no data source yet**, so I rendered an honest "coming soon" card instead of inventing numbers. Schema proposal to make them real is below — needs your OK (your rule: no schema changes without asking).

---

## How it was built (so it's coherent, not 50 hand-painted pages)

1. **Foundation first.** I rewrote the design *tokens* + the shared `Button`/`Card` material + fonts to Arcade. Because the app is token-driven, that re-skinned **every** page at once (cream, ink borders, hard shadows, yellow buttons, new type). Then I added a reusable Arcade vocabulary (`tile-yellow/teal/violet/coral/blue`, `arcade-badge*`, `arcade-track`, `arcade-streak`, `arcade-medal`, `belt-*`, the ink-dark sidebar).
2. **Flagship surfaces hand-built + verified** (landing, login).
3. **Everything else swept by parallel agents** using that vocabulary + the mockups as reference — coach dashboard, ~15 coach pages, ~12 client pages, the client portal, and the auth flow. Every agent was told: visual-only, preserve all logic/data/links, honest copy, no raw enums.
4. **Integrated → full build → fixed 3 type errors → green.**

---

## What's done, by surface

| Surface | State | Verified |
|---|---|---|
| **Landing** | Ink nav + founding banner, split hero w/ app-preview, belt feature/step tiles, ink pricing ($99 founding + $79/$149/$299), CTA, ink footer | ✅ pixel (desktop+mobile) |
| **Login / Signup / Subscribe / Forgot** | Bright cream, Coach/Student belt choice-tiles, white brutal form cards, $99 yellow brutal block (Stripe logic intact) | ✅ login pixel; rest build+code |
| **Coach dashboard** | Belt-color stat tiles from **real** data, honest empty states, brutal Today/Messages/QuickActions | build + code |
| **Coach pages (~15)** | clients, schedule, classes, payments, invoices, memberships, passes, packages, programs, analytics, leads, messages — belt KPIs, arcade status badges (no raw enums), progress tracks | build + code |
| **Client portal home** | Real XP/streak/level, next session, passes/goals/programs, quick-actions — all Arcade | build + code |
| **Client pages (~12)** | passes, classes, membership, sessions, invoices, videos, programs, goals, assignments, profile — brutal cards, belt tiles, honest coverage labels | build + code |
| **Coach sidebar** | Ink-dark + belt-yellow active pill, readable | build + code |
| **Foundation** | Tokens, fonts (Space Grotesk + DM Sans), material, utilities | ✅ build green |

---

## ⚠️ Honest caveats (please skim)

1. **Authed pages aren't pixel-verified.** They build and the code is reviewed, but I did not screenshot them (would mean many authed loads against your Free/Nano prod DB, which an audit once knocked offline). **Recommend: run `npm run dev`, log in as the demo coach, and click through coach + client once.** Likely-fine, but a 10-minute human eyeball before any deploy is wise.
2. **The messages/chat surface** renders through shared components — it's Arcade-themed by the foundation (cream/ink) but didn't get bespoke belt-color polish. Fine, just not as "loud."
3. **Testimonials section** was rebuilt (teal section, colored cards) but is **not shown** on the landing — it uses *fictional* coach quotes, and putting fake testimonials live would break the honest-copy rule. Wire it up once you have a real testimonial or two.
4. **I removed the dark KatanaOpening intro** (the cinematic katana splash) — it clashed with the bright Arcade theme. We can design a playful Arcade intro later if you want one.
5. **The login marketing copy** still says "Run your whole coaching business." while the landing says "…coaching practice from one place." Minor; align when you do a copy pass.

---

## 🎮 Gamification — real vs. proposed (needs your decision)

**Already real (shown now):** XP, streak days, level, assignments completed — these live in your `client_rewards` table and now render as belt-yellow tiles + `arcade-streak` pills on the portal and assignments page.

**Built but honestly placeholdered ("coming soon" card)** because there's **no data for them yet:**
- **Belts / ranks** (White→Blue→Purple→Brown→Black, stripes, % to next).
- **Achievements / medals** (First Class, 5-Day Streak, 10 Classes, etc.).
- **Pass-credit counter on the portal home** (passes aren't in the portal data bundle — it's just a link for now).

**To make belts + medals real, I'd need a schema change — your approval required.** Proposed (minimal):
- `client_belts` — `client_id, workspace_id, belt, stripes (0–4), awarded_at, awarded_by` + a per-coach belt definition (default to BJJ belts, coach-editable).
- `achievements` (definitions: key, name, icon, criteria) + `client_achievements` (`client_id, key, earned_at`), with server-side award hooks on booking/attendance/streak milestones.
- Coach UI to award belts/stripes on the client-detail page; portal shows belt + medals.
- ~2 migrations + RLS + a small coach award UI + earning logic. **Say the word and I'll build it.** Until then, the honest "coming soon" card stays.

---

## ▶ Preview it yourself

```
git checkout design/dojo-arcade
npm run dev        # then open http://localhost:3000  (landing)
                   # log in as the demo coach to see coach + client
```
Screenshots already captured: `screenshots/arcade-landing-desktop.png`, `-mobile.png`, `arcade-login.png`, `arcade-signup.png`, `arcade-subscribe.png`.

## ▶ Next steps (your call)
1. **Eyeball the authed pages** locally (coach + client) and tell me anything that feels off — I'll fix.
2. **Approve the gamification schema** if you want real belts + medals (the retention moat).
3. **Then:** final polish pass → deploy `design/dojo-arcade` to prod → DM your founding coach.

*Reskin by foundation + 6 parallel code-verified agents. Full build green. Branch `design/dojo-arcade`, not pushed, not deployed.*
