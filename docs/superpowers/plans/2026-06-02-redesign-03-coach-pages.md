# Redesign Plan 3 — Coach Inner Pages

> Execute task-by-task (executing-plans). Grounding inventory: `2026-06-02-redesign-coach-pages-inventory.md`.

**Goal:** Bring the ~18 coach inner pages onto one consistent glossy chrome — *without* rewriting them. Strategy: **evolve the shared components they already use** so the change ripples app-wide, then migrate the ad-hoc-styled pages in batches.

**Why this strategy:** The pages already work and are themed; the problem is inconsistency (3 header patterns, 4 panel patterns, 3 icon approaches, an old/new token split). The highest-leverage, lowest-risk move is to upgrade the *shared* primitives (`Card`, `PageHeader`) — instantly lifting every page that uses them — before touching individual pages. (Honors "visible changes first" + "rebuild not reskin": no blind class-swaps on page JSX.)

**Theme safety:** globals defines a `dark` Tailwind variant (`@custom-variant dark (&:where([data-theme='dark'], …))`) and theme-scoped CSS. All gloss is applied **dark-only** so non-dark usages (e.g. billing) are unaffected.

**Verification:** `tsc` + `npm run build` (stop dev first) + browser checkpoint across several inner pages (clients, payments, invoices, packages, analytics, subscription).

---

## Foundation (this session) — ripple changes

### Task A: `PageHeader` — add inked `icon` prop (additive)
**File:** `components/layout/PageHeader.tsx`
- Add optional `icon?: React.ReactNode` to `PageHeaderProps`; render it before the title (small, brass-tinted) when present. Existing callers (no icon) are visually unchanged.
- Verify: `tsc`. Commit `feat(ui): PageHeader icon slot`.

### Task B: `Card` → glossy (dark)
**Files:** `app/globals.css` (+ `.card-gloss`), `components/ui/Card.tsx`
- Add theme-aware `.card-gloss` (light base = `--bg-subtle` + `--border-default` + `--shadow-xs`; dark = glossy gradient + top highlight + warm shadow).
- In `Card.tsx`, change the `default` and `elevated` variant strings to use `card-gloss rounded-[10px] text-[var(--text-primary)]` (drop their hardcoded `bg/border/shadow`; keep `elevated`'s hover lift + border-strong). Leave `ghost/accent/glow` as-is.
- Ripples to: clients/[id], analytics, packages, payments, invoices, subscription, settings, videos, messages-not.
- Verify: `tsc` + build + browser checkpoint. Commit `feat(ui): glossy Card surface (dark)`.

---

## Batches (follow-on sessions) — per the inventory doc

1. **List/table pages already on PageHeader** — clients, programs, packages, invoices, payments, videos: tokenize `--color-*`→new, swap header lucide→inked, `.empty-state-coach`→`EmptyState` (ensō).
2. **Adopt PageHeader + unify panels** — classes, memberships, analytics, subscription.
3. **Complex** — schedule, leads, promote.
4. **Settings + detail** — settings, settings/appearance, clients/[id], programs/[id], messages.

New primitives to introduce during batches (not the foundation): `EmptyState` (inked ensō), `Tabs` (replaces 8 hand-rolled strips), standardize KPI strips on existing `StatCard`. Each batch: tsc + build + checkpoint; commit per page or per small group.
