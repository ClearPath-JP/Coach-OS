# Claude Chrome — KINDO Audit Prompt

_Reusable audit brief. Built 2026-05-26 (session 21)._

## How to use
1. Start the dev server: `npm run dev` → http://localhost:3000
2. **Audit on localhost, NOT prod.** The brass rebrand + new lead engine live only on `rebuild/v2`; prod (`coach.foundos.ai`) is still the old build.
3. Paste everything between the `⬇` and `⬆` markers below into Claude Chrome.
4. Bring the findings report back here — fixes get implemented in Claude Code, not in the browser.

---

⬇ COPY FROM HERE ⬇

You are doing a design + UX audit of **KINDO**, a premium coaching SaaS, running locally at **http://localhost:3000**. You are auditing only — **do not change any code**. Produce a findings report I can hand to my engineer.

### What KINDO is
A calm, premium, dojo-inspired platform for solo 1-on-1 coaches. Aesthetic = Japanese-minimal, warm-dark, craftsmanship over clutter. Voice = honest and grounded — no hype, no invented stats, no fake testimonials or logos.

### Definition of "on-brand" (your rubric)
- **Accent = Polished Brass `#c8882e`** (hover `#dba048`, deep `#9c6a22`) on a *warm* near-black background.
  - 🔴 Flag ANY crimson/burgundy (`#7f1d1d`) or amber/orange — that's the old palette and must not appear on coach or landing surfaces.
  - Flag any cold / blue-gray darks — the dark is *warm*.
- **Fonts:** headings/display = **Shippori Mincho** (serif). Body/UI = **Instrument Sans** (sans). 🔴 Flag any other font (system default, Times, DM Sans, Cormorant, etc.).
- **Wordmark:** "KINDO" rendered as KIN + **DO**, with "DO" in brass.
- **Primary CTA verb = "Open Your Dojo."** Flag inconsistent or stale CTA wording.
- **Layout:** generous calm spacing, clear hierarchy, aligned grids, no clutter. Premium = breathing room + restraint.
- **Interactive states** (focus rings, hovers) should be brass, never crimson.
- Note: the **client portal** (`/client/*`) is *intentionally* themed per-"stance" with different accent colors — do NOT flag those accents as off-brand.

### Method (apply to every page)
1. View at desktop width first, then **actually resize the window to 375px** and re-check. Never report a mobile issue you haven't seen at 375px.
2. Bucket each finding:
   - 🔴 **Broken / embarrassing** — blocks the demo, looks unfinished, or off-brand color/font.
   - 🟡 **Rough edge** — noticeable; should fix soon (spacing, alignment, copy, contrast).
   - 🟢 **Solid** — working well and on-brand (confirm the good too).
   - 💡 **Idea** — optional enhancement.
3. Screenshot anything 🔴 or 🟡.
4. Check across: color/font adherence, spacing rhythm, alignment, contrast/legibility, copy quality + honesty, empty states, loading states, error states, hover/focus states, and 375px responsiveness.

### Setup notes
- A **katana slash intro** (~0.8s) plays once on the first page load of a session, then clears — intentional, not a bug. If it blocks a screenshot, enable reduced-motion or run `sessionStorage['sensei-opening-played'] = '1'` in the console.
- Coach login: **coach@example.com / Demo123!**
- If a heavy authed page 500s after lots of navigation, that's a known local dev-server memory issue — tell me and I'll restart it; don't log it as a product bug.

### PASS 1 — Demo-critical (do these THREE first — they're the sales surface)
These are exactly what a prospect sees in my demo. They must feel premium, and the lead search must feel magical.

1. **`/` (landing)** — hero headline + subhead, the "Open Your Dojo" CTA, wordmark, pricing (should show **$69 / $129 / $199** tiers + a **$99/mo founding** offer — flag any stale prices), honest copy (no invented stats/logos/testimonials), section rhythm, footer, and the hero at 375px.
2. **`/login`** — dual coach/client login, form clarity, labels, error states, brass focus rings (not crimson), wordmark, 375px.
3. **`/coach/leads`** (the star of the demo) — log in, then evaluate: the search input (city + niche), the run/loading state (an Instagram scrape takes ~20–40s — make sure the wait reads as intentional, not broken), the results cards (handle, platform, lead type, working profile link), the empty state, the quota display, and any error/503 messaging. **Recommended: run exactly ONE real search** to validate the full live flow (each search costs ~$0.25 of API credit, so don't repeat it). If you'd rather not spend credit, inspect the input/loading/empty states only and say so. Check 375px.

### PASS 2 — Full app sweep (after Pass 1)
Same method. Group findings by area:
- **Coach surfaces:** `/coach/dashboard`, `/coach/clients` (+ open one client detail), `/coach/schedule`, `/coach/classes`, `/coach/programs`, `/coach/packages`, `/coach/invoices`, `/coach/payments`, `/coach/messages`, `/coach/analytics`, `/coach/videos`, `/coach/subscription`, `/coach/settings` (+ `/coach/settings/appearance`).
- **Client portal** (`/client/*`): `dashboard`, `classes`, `programs`, `assignments`, `goals`, `sessions`, `invoices`, `messages`, `profile`. (Per-stance accents are intentional — don't flag them.)
- **Auth / onboarding:** `/signup`, `/forgot-password`, `/onboarding` (steps 2–4), `/browse`, `/subscribe`.

### Output format
For each page: a one-line verdict, then findings as a bulleted list with the bucket emoji. End with a **"Fix batch"** — all 🔴 and 🟡 items ordered by impact — so my engineer can ship them in one pass.

⬆ COPY TO HERE ⬆
