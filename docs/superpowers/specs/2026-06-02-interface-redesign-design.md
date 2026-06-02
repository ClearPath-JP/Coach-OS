# Kindo Interface Redesign — Design Spec

- **Date:** 2026-06-02
- **Branch:** `rebuild/v2`
- **Status:** ✅ Approved by owner 2026-06-02 — ready for implementation plan
- **Driving brief (owner's words):** *"Set up the site so it's very organized… a glossy feel… clean… no default symbols or images… take time and do the little things, because this is MY app."*

---

## 1. Intent

Make the app feel like a **crafted, premium product** — not a template — while making it dramatically more **organized**. Every visual decision is bespoke and deliberate. The bar: a coach opens it and *feels* the care, even if they can't name why.

**Success looks like:** a coherent warm-mono + brass identity, a sidebar a coach can read at a glance, a dashboard that's a true morning cockpit, and a hand-built icon language nobody else has.

---

## 2. Locked identity (decided with the owner, 2026-06-02)

| # | Decision | Choice |
|---|---|---|
| 1 | **Material / colour** | **Mono + Brass Spark** — warm near-black, glossy depth, brass `#c8882e` used surgically as the signature only |
| 2 | **Navigation** | **Four labeled zones** (Dashboard · Coaching · Offerings · Money · Grow) + ⌘K command palette |
| 3 | **Iconography** | **Inked Dojo** — hand-drawn brush-energy SVG marks + brass ensō for heroes; **zero icon-font / stock** |
| 4 | **Dashboard** | **Command Rail** — KPIs + a wide "Today" column + an always-visible right rail (attention · messages · quick actions) |

These were each chosen live against side-by-side glossy mockups (saved in `.superpowers/brainstorm/`).

---

## 3. Scope

**In scope — full redesign, one pass, foundation-first:**
- **Coach app** — all ~20 routes (`app/coach/**`).
- **Client portal** — all ~12 routes (`app/client/(main)/**`), keeping its **per-workspace accent** (see §4.2).

**Out of scope (this round):**
- Admin area (`app/admin/**`), public/marketing/landing, onboarding, billing/auth shells — *unless trivially carried by shared primitives.*
- **Merging Payments + Invoices** into one "Billing" page — deferred; they stay separate.
- Any data-model, Supabase schema, RLS, or business-logic change. **This is a presentation + IA layer only.**

---

## 4. Design language

### 4.1 Material & colour — "Mono + Brass Spark"
Build on the existing `[data-theme='dark']` tokens in `app/globals.css` (warm-black surfaces already defined). The redesign **tightens and systematizes** them; it does not reinvent the palette.

- **Surfaces:** warm near-black, layered. Elevation follows Superhuman's rule — *nearer surfaces are lighter, not darker* (`#0A0908` sidebar → `#0F0D0B` app → `#161310` panel → glass overlays on top).
- **Text:** warm silver tiers (`#E8E6E3 / #9C9890 / #787068 / #403C38`). Never pure white.
- **Brass budget (the core rule):** brass appears on **at most a few elements per screen** — the active nav rail, the wordmark `DO`, the single primary CTA, one KPI accent, and focus rings. Everything else is monochrome. If a screen has two brass buttons, one is wrong.
- **Glossy recipe (CSS-level, zero new packages):**
  - *Panel:* `linear-gradient(180deg, rgba(255,255,255,.04), transparent 35%)` over the warm fill + `border-top-color: rgba(255,255,255,.07)` + layered warm-black shadow + faint top-left specular sheen (`::before` radial).
  - *Glass* (modals, command palette, popovers): `backdrop-filter: blur(22px) saturate(155%)` + inset top highlight (Raycast recipe) — extends the existing `.glass-modal`.
  - *Grain:* keep the existing `body::after` fractal-noise overlay (~0.04), disabled under `prefers-reduced-motion`.
  - *Brass CTA:* brass gradient + inset top highlight + inset bottom shadow + soft outer brass glow + 1px brass edge.
  - *Borders:* hairlines at `rgba(255,255,255,.06–.08)`.

### 4.2 Colour — client portal
The portal **keeps its per-workspace accent** (`--cp-accent`, set by `StanceInjector` / `AccentInjector`) as its "spark" instead of brass. **Same material, same gloss, same gloss rules — accent variable swapped.** Fallback when no stance is set = brass. *(Decision to confirm — §10.)*

### 4.3 Typography (already loaded — formalize roles)
- **Shippori Mincho** (display): page titles, stat values, wordmark, hero numerals, section heroes.
- **Instrument Sans** (body/UI): everything else, 13–14px base.

### 4.4 Iconography — "Inked Dojo"
- A **hand-built SVG icon set** delivered as a typed React component module (e.g. `components/icons/`), replacing `lucide-react` usage starting with `coach-nav-icons.tsx`. One source of truth.
- **Optical sizing:** lighter brush weight at ≤16px (nav, buttons, cells); full brush energy at hero scale.
- **Ensō (brass brush circle)** is the signature hero mark — used on the login splash, the loading screen, empty states, and section heroes.
- `lucide-react` is phased out of redesigned surfaces; remove the dep only once no surface imports it.

### 4.5 Motion
Keep the existing restrained eases + staggers. Add: nav active-state transition, command-palette enter, card hover-lift, and a one-shot specular shimmer on the primary CTA. All gated by `prefers-reduced-motion`.

---

## 5. Information architecture

### 5.1 Coach sidebar (old → new)

| New zone | Items | From (old) |
|---|---|---|
| *(top, no label)* | Dashboard | Command Center |
| **Coaching** | Schedule · Classes · Clients · Messages | Command Center + Clients |
| **Offerings** | Programs · Packages · Memberships | Business |
| **Money** | Payments · Invoices · Analytics | Business |
| **Grow** | Promote · Lead Research `PRO` · Videos | Grow + Business (Videos moves) |
| *(footer)* | Profile · Subscription · Settings | already in footer |

- **Labeled, barely-there headers** (tiny, dim uppercase).
- **⌘K command palette (new):** fuzzy-jump to any destination + quick actions (Book session, Message client, Record payment, New client). Glass surface.
- **Lead Research** shows a `PRO` pill instead of dead-ending un-entitled coaches.
- **Mobile:** the bottom dock keeps the top destinations; a **"More" sheet** exposes the full set (today's dock omits most pages — this closes that gap).

### 5.2 Client portal nav
Apply the same grouping discipline (draft, to refine during build):
- *(top)* Dashboard
- **Training** — Programs · Sessions · Classes · Goals · Assignments
- **Account** — Membership · Invoices · Messages · Profile

Resolve the duplicate `portal` vs `dashboard` client route during P6.

---

## 6. Key screens

### 6.1 Dashboard — "Command Rail"
Reference mockup: `.superpowers/brainstorm/.../dashboard-layout.html` (Option A).
- **Top:** greeting (Shippori) + date + "Next: <client> at <time>" + a single brass **Book a session** CTA.
- **KPI row:** Active clients · Sessions this week · Revenue (month) · Pending invoices — with trend arrows (data already exists).
- **Main column:** *Today* (today's sessions, inline) + *Get started* (until complete).
- **Right rail (always visible):** *Needs attention* (actionable — unpaid invoices with a real action) · *Messages* (recent + unread dots) · *Quick actions* (Book · Message · Payment).
- **Data:** `/api/coach/dashboard-summary`, `/api/coach/dashboard-attention`, `/api/coach/sessions`, `/api/messages/conversations` (all exist). Today/next/unread logic can be lifted from the **dead** `CoachDashboardContent`.
- **Cleanup:** delete the unused cinematic dashboard (`CoachDashboardContent.tsx`, `CoachDashboardWithProfile.tsx`) — confirmed not imported by any live route.

### 6.2 Shared page chrome (the "very organized" backbone)
Every page gets the same skeleton so the app feels like one product:
- **PageHeader** (evolve `components/layout/PageHeader.tsx`): Shippori title + optional subtitle + right-aligned action slot + consistent spacing.
- **GlossPanel**: the standard surface (glossy fill, header with brass-dim uppercase label, body) — supersedes ad-hoc `.game-panel` / card variants.
- **Primitives:** StatCard · ListRow (hairline dividers, tabular numerals) · Table treatment · **EmptyState** (ensō + copy + CTA) · Buttons (primary brass-gloss / ghost / danger) · Fields (inset glossy inputs) · Modal (glass) · AttentionStrip · QuickActions · DashboardRail.

### 6.3 Inner pages (rollout pattern)
Each page is re-laid on PageHeader + GlossPanels + shared primitives, matched to its dominant pattern:

| Pattern | Pages |
|---|---|
| Table / list | Clients, Invoices, Payments, Memberships, Packages, Leads, Videos |
| Calendar / board | Schedule, Classes |
| Detail | Clients/[id], Programs/[id] |
| Form / settings | Settings, Settings/appearance, Subscription |
| Composer / wizard | Promote |
| Charts | Analytics |

### 6.4 Client portal screens
Same primitives, per-workspace accent. Pages: Dashboard, Programs(+detail), Sessions, Classes, Goals, Assignments, Membership, Invoices, Messages, Profile.

---

## 7. Components to build / evolve

`IconInked` set + `Enso` · `CommandPalette` · `GlossPanel` · `PageHeader` (evolve) · `StatCard` · `ListRow` · `Button` (variants) · `Field`/`Input` · `Modal`/glass · `EmptyState` · `AttentionStrip` · `QuickActions` · `DashboardRail` · `Sidebar` (evolve, both variants) · `MobileDock` + `MoreSheet`.

---

## 8. Build approach (phases — built foundation-first, delivered as one pass)

| Phase | Work | Done when |
|---|---|---|
| **P0 Foundation** | Tighten dark tokens; add gloss utility classes; remove dead dashboard | tsc + build green |
| **P1 Icons** | Build inked icon set + ensō; swap into nav | nav renders inked, no lucide in nav |
| **P2 Primitives** | GlossPanel, PageHeader, Button, Field, Modal, EmptyState, StatCard, ListRow | primitives demoed |
| **P3 Nav** | 4-zone labeled sidebar + ⌘K + mobile More sheet | all 16 links reachable; verified in browser |
| **P4 Dashboard** | Command Rail | matches mockup; live data wired |
| **P5 Coach pages** | Roll primitives across all ~20 coach routes | each page on shared chrome |
| **P6 Client portal** | Portal nav + pages, per-workspace accent | accent swaps correctly |
| **P7 QA** | tsc, `next build`, 375px mobile pass, reduced-motion, contrast/a11y | all green, no regressions |

Every phase ends tsc-clean + build-green + browser-verified before the next.

---

## 9. Constraints (from CLAUDE.md + project memory)
- TypeScript only. **No schema / RLS / business-logic changes** — presentation + IA only.
- **Ask before any new package** — target is **zero new deps** (pure CSS + SVG).
- Never touch `.env`. Keep changes focused and reversible (solo founder).
- Read the real file before editing; verify tsc + browser before committing (lesson from prior nav work).
- Prod Supabase is Free/Nano — **no heavy automated test sweeps against prod**.

---

## 10. Resolved decisions (owner-confirmed 2026-06-02)
1. **Client portal accent** = **per-workspace** (not brass). ✅ Preserves the existing stance feature.
2. **Mobile nav** = bottom dock + **"More" sheet**. ✅
3. **Admin + public landing** = **out of scope** this round (coach app + client portal only). ✅
4. **Payments + Invoices** = **stay separate** for now. ✅
5. *Build-time detail:* resolve the client **`portal` vs `dashboard`** duplicate route — pick the canonical one during P6.

---

## 11. Definition of done
A coach (and their clients) experience one coherent, glossy, organized product: a readable 4-zone sidebar, a working ⌘K, a Command-Rail dashboard on live data, a hand-drawn icon language, and every page on the shared chrome — all tsc-clean, build-green, mobile-checked, with no data/logic regressions.
