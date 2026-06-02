# Redesign Plan 1 — Foundation & Navigation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the inked-dojo icon system and the new 4-zone labeled coach sidebar with a working ⌘K command palette and a mobile "More" sheet — the first visible win of the redesign.

**Architecture:** Evolve what exists. The `Sidebar` engine (`components/layout/Sidebar.tsx`) already renders grouped sections, labels, the brass active-rail, and an inline filter; we change the *data* (`CoachSidebarShell.tsx`) and swap icons. A full command palette already exists (`components/CommandPalette.tsx`); we mount it in the coach layout, expand its item list, and restyle it glossy-dark. Mobile (`CoachNav.tsx`) gains a More sheet.

**Tech stack:** Next.js 16 (App Router, RSC + client components), TypeScript, Tailwind v4, CSS variables in `app/globals.css`. **Zero new packages.** Icons are hand-built SVG.

**Verification model (read this):** This is a presentation layer. There is no `@testing-library/react` in the repo, so component "tests" are: (1) `npx tsc --noEmit` clean, (2) browser-verified against the approved mockups using the existing Playwright harness (`screenshots/*.mjs`, demo coach `coach@example.com` / `Demo123!`, dev server on `http://localhost:3000`), and (3) a final `next build`. Logic-only helpers get a real Jest test. **Visual source of truth:** `.superpowers/brainstorm/5745-1780374159/content/` (`nav-structure.html`, `icon-direction.html`). **Rules source of truth:** `docs/superpowers/specs/2026-06-02-interface-redesign-design.md`.

**Out of scope for Plan 1:** `coach-sidebar-nav.tsx` / `coach-nav-icons.tsx` (live only in the out-of-scope billing layout — DO NOT TOUCH). Dashboard, inner pages, client portal (later plans).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `components/icons/inked.tsx` | The hand-built inked-dojo icon set: one `<Icon name=…>` + `<Enso>` | **Create** |
| `components/layout/Sidebar.tsx` | Add `pill` support on nav items; turn the decorative ⌘K hint into a real palette trigger | **Modify** |
| `app/coach/CoachSidebarShell.tsx` | New 4-zone labeled `SECTIONS` using inked icons + `PRO` pill | **Modify** |
| `components/CommandPalette.tsx` | Full destination + action list; glossy-dark glass restyle | **Modify** |
| `app/coach/layout.tsx` | Mount `<CommandPalette/>` on coach surfaces | **Modify** |
| `app/coach/CoachNav.tsx` | Mobile dock → inked icons + a "More" trigger | **Modify** |
| `app/coach/CoachMoreSheet.tsx` | Mobile bottom-sheet listing every zone | **Create** |
| `app/globals.css` | One `.gloss-glass` utility for the palette/sheet surface | **Modify** |

---

## Task 1: Inked icon set

**Files:**
- Create: `components/icons/inked.tsx`

- [ ] **Step 1: Create the icon module**

Paths are transcribed verbatim from the approved mockup sprite (`.superpowers/brainstorm/.../nav-structure.html`). Default `strokeWidth=1.75` gives inked weight while staying crisp at 16px (optical sizing); `Enso` is the full brush hero.

```tsx
// components/icons/inked.tsx
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type InkedIconName =
  | 'dashboard' | 'schedule' | 'classes' | 'clients' | 'messages'
  | 'programs' | 'packages' | 'memberships' | 'payments' | 'invoices'
  | 'analytics' | 'promote' | 'leads' | 'videos' | 'subscription'
  | 'settings' | 'search'

const PATHS: Record<InkedIconName, React.ReactNode> = {
  dashboard: (<><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="4.5" rx="1.5"/><rect x="13" y="11" width="7" height="9" rx="1.5"/><rect x="4" y="13.5" width="7" height="6.5" rx="1.5"/></>),
  schedule: (<><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4.5M15.5 3v4.5"/></>),
  classes: (<><path d="M3 8.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 8.5v2a1.6 1.6 0 0 0 0 3v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15v-2a1.6 1.6 0 0 0 0-3z"/><path d="M13 7v10" strokeDasharray="1.5 2.2"/></>),
  clients: (<><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.6 5.6 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.3"/><path d="M16 14.6a4.4 4.4 0 0 1 4.5 4.4"/></>),
  messages: (<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-7l-4 3.2V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z"/>),
  programs: (<><rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></>),
  packages: (<><path d="M12 3l8 4v9l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v9"/></>),
  memberships: (<><circle cx="12" cy="9.5" r="5"/><path d="M9 13.5L7.5 21l4.5-2.6L16.5 21 15 13.5"/></>),
  payments: (<><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 14.5h4"/></>),
  invoices: (<><path d="M6.5 3.5h11v17l-2-1.4-1.8 1.4-1.7-1.4-1.8 1.4-1.9-1.4-1.1.8z"/><path d="M9.5 8.5h5M9.5 12h5"/></>),
  analytics: (<><path d="M4 4v16h16"/><path d="M7.5 15.5l3.5-4 2.5 2.4 4-5.4"/></>),
  promote: (<><path d="M4 10v4l11 4.5V5.5z"/><path d="M15 8.5a3.5 3.5 0 0 1 0 7"/><path d="M7 14.5v3.5"/></>),
  leads: (<><circle cx="10" cy="10.5" r="5.2"/><path d="M14 14.5l5.5 5.5"/><path d="M18 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></>),
  videos: (<><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10 9.5l4.5 2.5L10 14.5z"/></>),
  subscription: (<path d="M4 18.5h16M4.5 18l-1-9 4.5 4 4-7 4 7 4.5-4-1 9"/>),
  settings: (<><path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.4"/><circle cx="15" cy="16" r="2.4"/></>),
  search: (<><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></>),
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  className,
  style,
}: {
  name: InkedIconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}

/** Brass brush-circle — the signature hero mark (login, empty states, loading). */
export function Enso({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} aria-hidden>
      <path d="M76 26 A34 34 0 1 0 80 60" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
      <path d="M73 23 A37 37 0 1 0 83 57" stroke="rgba(var(--accent-rgb),0.3)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors referencing `components/icons/inked.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/icons/inked.tsx
git commit -m "feat(icons): inked-dojo icon set (Icon + Enso)"
```

---

## Task 2: Sidebar engine — `pill` support + real ⌘K trigger

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `pill` to the item type**

In `components/layout/Sidebar.tsx`, extend `SidebarNavItem` (currently lines 12–16):

```tsx
export interface SidebarNavItem {
  href: string
  label: string
  icon?: React.ReactNode
  /** Small uppercase tag rendered at the row's end, e.g. "PRO". */
  pill?: string
}
```

- [ ] **Step 2: Render the pill in `NavRowsCoach`**

In `NavRowsCoach`, replace the existing numeric `badge` block (the `{badge > 0 ? (…) : null}` near lines 286–297) with a pill renderer:

```tsx
{item.pill ? (
  <span
    className="ml-auto shrink-0 rounded-[4px] border px-1 py-px text-[8px] font-bold uppercase tracking-[0.1em]"
    style={{ color: 'var(--accent-dark)', borderColor: 'rgba(var(--accent-rgb),0.3)' }}
  >
    {item.pill}
  </span>
) : null}
```

(Delete the now-unused `const badge = 0` line and the `badges` prop usage is unchanged.)

- [ ] **Step 3: Make the footer ⌘K hint open the palette**

Import the helper at the top of the file:

```tsx
import { openCommandPalette } from '@/lib/command-palette'
```

In the coach `userBar` block, replace the decorative span (line ~408):

```tsx
<div className="mt-2 flex items-center justify-end px-1">
  <span className="text-[10px] text-[var(--text-quaternary)]">⌘K</span>
</div>
```

with a real trigger:

```tsx
<button
  type="button"
  onClick={() => openCommandPalette()}
  className="mt-2 flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-[11px] text-[var(--text-quaternary)] transition-colors hover:bg-[var(--coach-sidebar-hover)] hover:text-[var(--text-tertiary)]"
>
  <span>Quick jump</span>
  <span className="ml-auto rounded-[4px] border border-[var(--coach-sidebar-input-border)] px-1.5 py-px text-[10px]">⌘K</span>
</button>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(sidebar): pill support + real Cmd-K palette trigger"
```

---

## Task 3: Restructure the coach sidebar (4 labeled zones, inked icons)

**Files:**
- Modify: `app/coach/CoachSidebarShell.tsx`

- [ ] **Step 1: Replace the whole file**

This swaps the lucide imports + old `SECTIONS` for the inked icon set and the approved 4-zone IA (spec §5.1). Mapping is the approved one: Dashboard (top) · Coaching · Offerings · Money · Grow · footer.

```tsx
'use client'

import { Icon } from '@/components/icons/inked'
import { Sidebar, type SidebarNavItem, type SidebarNavSection } from '@/components/layout/Sidebar'

const TOP_ITEMS: SidebarNavItem[] = [
  { href: '/coach/dashboard', label: 'Dashboard', icon: <Icon name="dashboard" /> },
]

const SECTIONS: SidebarNavSection[] = [
  {
    title: 'Coaching',
    items: [
      { href: '/coach/schedule', label: 'Schedule', icon: <Icon name="schedule" /> },
      { href: '/coach/classes', label: 'Classes', icon: <Icon name="classes" /> },
      { href: '/coach/clients', label: 'Clients', icon: <Icon name="clients" /> },
      { href: '/coach/messages', label: 'Messages', icon: <Icon name="messages" /> },
    ],
  },
  {
    title: 'Offerings',
    items: [
      { href: '/coach/programs', label: 'Programs', icon: <Icon name="programs" /> },
      { href: '/coach/packages', label: 'Packages', icon: <Icon name="packages" /> },
      { href: '/coach/memberships', label: 'Memberships', icon: <Icon name="memberships" /> },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/coach/payments', label: 'Payments', icon: <Icon name="payments" /> },
      { href: '/coach/invoices', label: 'Invoices', icon: <Icon name="invoices" /> },
      { href: '/coach/analytics', label: 'Analytics', icon: <Icon name="analytics" /> },
    ],
  },
  {
    title: 'Grow',
    items: [
      { href: '/coach/promote', label: 'Promote', icon: <Icon name="promote" /> },
      { href: '/coach/leads', label: 'Lead Research', icon: <Icon name="leads" />, pill: 'PRO' },
      { href: '/coach/videos', label: 'Videos', icon: <Icon name="videos" /> },
    ],
  },
]

const BOTTOM_ITEMS: SidebarNavItem[] = [
  { href: '/coach/subscription', label: 'Subscription', icon: <Icon name="subscription" /> },
  { href: '/coach/settings', label: 'Settings', icon: <Icon name="settings" /> },
]

type CoachSidebarShellProps = {
  coachName: string | null
  coachAvatarUrl: string | null
}

export function CoachSidebarShell({ coachName, coachAvatarUrl }: CoachSidebarShellProps) {
  return (
    <div className="hidden lg:flex">
      <Sidebar
        variant="coach"
        wordmark
        topItems={TOP_ITEMS}
        sections={SECTIONS}
        bottomItems={BOTTOM_ITEMS}
        userBar={{
          displayName: coachName ?? 'Coach',
          avatarUrl: coachAvatarUrl,
          settingsHref: '/coach/settings',
        }}
        className="!h-dvh"
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Browser-verify the sidebar**

Start the dev server if not running (`npm run dev`, with `UPSTASH_REDIS_REST_URL`/`_TOKEN` set to a space). Log in as the demo coach and load `/coach/dashboard`.

Expected (compare to `nav-structure.html`, "Labeled" column):
- Four labeled zones in order: Coaching · Offerings · Money · Grow, Dashboard above them, Subscription + Settings in the footer.
- Inked icons on every row; brass active rail on the current page.
- `PRO` pill on Lead Research.
- Every row navigates to its route (click through all 14 + footer 2).

- [ ] **Step 4: Commit**

```bash
git add app/coach/CoachSidebarShell.tsx
git commit -m "feat(nav): 4-zone labeled coach sidebar with inked icons"
```

---

## Task 4: Glossy command palette + mount on coach surfaces

**Files:**
- Modify: `app/globals.css` (add `.gloss-glass`)
- Modify: `components/CommandPalette.tsx`
- Modify: `app/coach/layout.tsx`

- [ ] **Step 1: Add the glass utility**

Append to `app/globals.css` (after the existing `.glass-modal` block, ~line 854):

```css
/* Glossy glass surface — command palette, mobile sheets (dark) */
html[data-theme='dark'] .gloss-glass {
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 30%), rgba(16, 14, 12, 0.86);
  backdrop-filter: blur(22px) saturate(155%);
  -webkit-backdrop-filter: blur(22px) saturate(155%);
  border: 1px solid var(--border-default);
  border-top-color: rgba(255,255,255,0.08);
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -20px rgba(0,0,0,0.8);
}
```

- [ ] **Step 2: Expand the palette item list + restyle the surface**

In `components/CommandPalette.tsx`, replace the `items` `useMemo` (lines 28–46) with the full destination set + actions:

```tsx
  const items: CommandItem[] = useMemo(
    () => [
      { id: 'n-dash', section: 'Navigation', label: 'Go to Dashboard', run: () => router.push('/coach/dashboard') },
      { id: 'n-sched', section: 'Navigation', label: 'Go to Schedule', run: () => router.push('/coach/schedule') },
      { id: 'n-class', section: 'Navigation', label: 'Go to Classes', run: () => router.push('/coach/classes') },
      { id: 'n-clients', section: 'Navigation', label: 'Go to Clients', run: () => router.push('/coach/clients') },
      { id: 'n-msg', section: 'Navigation', label: 'Go to Messages', run: () => router.push('/coach/messages') },
      { id: 'n-prog', section: 'Navigation', label: 'Go to Programs', run: () => router.push('/coach/programs') },
      { id: 'n-pack', section: 'Navigation', label: 'Go to Packages', run: () => router.push('/coach/packages') },
      { id: 'n-member', section: 'Navigation', label: 'Go to Memberships', run: () => router.push('/coach/memberships') },
      { id: 'n-pay', section: 'Navigation', label: 'Go to Payments', run: () => router.push('/coach/payments') },
      { id: 'n-inv', section: 'Navigation', label: 'Go to Invoices', run: () => router.push('/coach/invoices') },
      { id: 'n-ana', section: 'Navigation', label: 'Go to Analytics', run: () => router.push('/coach/analytics') },
      { id: 'n-promo', section: 'Navigation', label: 'Go to Promote', run: () => router.push('/coach/promote') },
      { id: 'n-leads', section: 'Navigation', label: 'Go to Lead Research', run: () => router.push('/coach/leads') },
      { id: 'n-vid', section: 'Navigation', label: 'Go to Videos', run: () => router.push('/coach/videos') },
      { id: 'a-book', section: 'Actions', label: 'Book a session', shortcut: 'B', run: () => router.push('/coach/schedule') },
      { id: 'a-client', section: 'Actions', label: 'Add a client', shortcut: 'C', run: () => router.push('/coach/clients') },
      { id: 'a-msg', section: 'Actions', label: 'Message a client', shortcut: 'M', run: () => router.push('/coach/messages') },
      { id: 'a-pay', section: 'Actions', label: 'Record a payment', shortcut: 'P', run: () => router.push('/coach/payments') },
      { id: 's-sub', section: 'Settings', label: 'Subscription', run: () => router.push('/coach/subscription') },
      { id: 's-set', section: 'Settings', label: 'Settings', run: () => router.push('/coach/settings') },
    ],
    [router]
  )
```

Then restyle the surface for glossy-dark. Change the palette container (line 92) from the light `bg-[var(--cp-offwhite)]` to the glass utility:

```tsx
      <div className="gloss-glass relative z-10 w-full max-w-[640px] overflow-hidden rounded-[var(--radius-xl)]">
```

And the input border stays `border-[var(--border-default)]`; the active-row class (line 121) — change `bg-[var(--accent-light)]` to `bg-[var(--accent-surface)]` so it reads on dark:

```tsx
className={`flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-left ${active ? 'bg-[var(--accent-surface)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-subtle)]'}`}
```

- [ ] **Step 3: Mount the palette in the coach layout**

In `app/coach/layout.tsx`, add the import (after the `CoachNav` import, line 8):

```tsx
import { CommandPalette } from '@/components/CommandPalette'
```

Then render it inside the layout `<div>` wrapper, right after `<CoachNav … />` (after line 123):

```tsx
        <CommandPalette />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Browser-verify ⌘K**

On any `/coach/*` page: press ⌘K (or Ctrl+K). Expected: a glossy-dark glass palette opens, lists Navigation/Actions/Settings; typing "mem" filters to Memberships; ↑/↓ + Enter navigates; Esc closes. The sidebar footer "Quick jump ⌘K" button also opens it.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/CommandPalette.tsx app/coach/layout.tsx
git commit -m "feat(nav): glossy Cmd-K palette mounted on coach surfaces"
```

---

## Task 5: Mobile dock + "More" sheet

**Files:**
- Create: `app/coach/CoachMoreSheet.tsx`
- Modify: `app/coach/CoachNav.tsx`

- [ ] **Step 1: Create the More sheet**

```tsx
// app/coach/CoachMoreSheet.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type InkedIconName } from '@/components/icons/inked'

type Row = { href: string; label: string; icon: InkedIconName }
type Group = { title: string; rows: Row[] }

const GROUPS: Group[] = [
  { title: 'Coaching', rows: [
    { href: '/coach/schedule', label: 'Schedule', icon: 'schedule' },
    { href: '/coach/classes', label: 'Classes', icon: 'classes' },
    { href: '/coach/clients', label: 'Clients', icon: 'clients' },
    { href: '/coach/messages', label: 'Messages', icon: 'messages' },
  ] },
  { title: 'Offerings', rows: [
    { href: '/coach/programs', label: 'Programs', icon: 'programs' },
    { href: '/coach/packages', label: 'Packages', icon: 'packages' },
    { href: '/coach/memberships', label: 'Memberships', icon: 'memberships' },
  ] },
  { title: 'Money', rows: [
    { href: '/coach/payments', label: 'Payments', icon: 'payments' },
    { href: '/coach/invoices', label: 'Invoices', icon: 'invoices' },
    { href: '/coach/analytics', label: 'Analytics', icon: 'analytics' },
  ] },
  { title: 'Grow', rows: [
    { href: '/coach/promote', label: 'Promote', icon: 'promote' },
    { href: '/coach/leads', label: 'Lead Research', icon: 'leads' },
    { href: '/coach/videos', label: 'Videos', icon: 'videos' },
  ] },
  { title: 'Account', rows: [
    { href: '/coach/subscription', label: 'Subscription', icon: 'subscription' },
    { href: '/coach/settings', label: 'Settings', icon: 'settings' },
  ] },
]

export function CoachMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="gloss-glass absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[20px] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--border-strong)]" />
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-3">
            <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-quaternary)]">{g.title}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {g.rows.map((r) => {
                const active = pathname === r.href || pathname.startsWith(r.href + '/')
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] ${active ? 'bg-[var(--accent-surface)] text-[var(--text-primary)] [&_svg]:text-[var(--accent)]' : 'text-[var(--text-secondary)] [&_svg]:text-[var(--text-tertiary)]'}`}
                  >
                    <Icon name={r.icon} size={17} />
                    {r.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update the dock to inked icons + a More trigger**

Replace `app/coach/CoachNav.tsx`. Dock = the 4 highest-frequency destinations + More; lucide is removed.

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type InkedIconName } from '@/components/icons/inked'
import { CoachMoreSheet } from './CoachMoreSheet'

const NAV_ITEMS: { href: string; label: string; icon: InkedIconName }[] = [
  { href: '/coach/dashboard', label: 'Home', icon: 'dashboard' },
  { href: '/coach/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/coach/clients', label: 'Clients', icon: 'clients' },
  { href: '/coach/messages', label: 'Messages', icon: 'messages' },
]

type CoachNavProps = {
  brandName: string
  coachName: string | null
  coachAvatarUrl: string | null
}

/** Mobile-only bottom dock. Desktop navigation lives in CoachSidebarShell. */
export function CoachNav(_props: CoachNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <nav className="coach-nav__mobile" aria-label="Navigation">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`coach-nav__mobile-link ${isActive(href) ? 'coach-nav__mobile-link--active' : ''}`}
          >
            <Icon name={icon} size={20} />
            <span className="coach-nav__mobile-label">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="coach-nav__mobile-link"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
          </svg>
          <span className="coach-nav__mobile-label">More</span>
        </button>
      </nav>
      <CoachMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Browser-verify mobile**

Resize to 375px (or Playwright `viewport: { width: 375, height: 812 }`). Expected: a 5-slot dock (Home, Schedule, Clients, Messages, More); tapping **More** opens a glassy bottom sheet listing every zone with inked icons; tapping a row navigates and closes the sheet; the backdrop closes it.

- [ ] **Step 5: Commit**

```bash
git add app/coach/CoachMoreSheet.tsx app/coach/CoachNav.tsx
git commit -m "feat(nav): mobile dock with inked icons + More sheet"
```

---

## Task 6: Final QA pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build completes; no new lint/type errors in `app/coach/**`, `components/layout/Sidebar.tsx`, `components/CommandPalette.tsx`, `components/icons/inked.tsx`.

- [ ] **Step 3: Reduced-motion + contrast spot-check**

In the browser with "Reduce motion" on: nav renders, no animation jank. Confirm sidebar label + icon contrast is legible on the warm-black surface (spec §4.1 text tiers).

- [ ] **Step 4: Desktop + mobile walkthrough (Playwright, demo coach)**

Verify against `nav-structure.html`: all 16 destinations reachable from desktop sidebar; ⌘K opens/filters/navigates; 375px dock + More sheet reach everything. Capture `screenshots/redesign-01-sidebar.png` + `screenshots/redesign-01-mobile-more.png`.

- [ ] **Step 5: Final commit (screenshots + any fixups)**

```bash
git add -A
git commit -m "test(nav): Plan 1 QA — sidebar, Cmd-K, mobile More verified"
```

---

## Self-review notes (author)
- **Spec coverage:** §4.4 icons → Task 1; §5.1 sidebar + ⌘K + PRO pill + mobile More → Tasks 2–5; §4.1 gloss (palette/sheet glass) → Task 4 `.gloss-glass`. Dashboard/pages/portal are later plans (by design).
- **Type consistency:** `InkedIconName` + `Icon`/`Enso` defined in Task 1 are used identically in Tasks 3, 5. `SidebarNavItem.pill` defined in Task 2 is used in Task 3.
- **No placeholders:** every code step ships full code; verification steps give exact commands + expected results.
- **Do-not-touch:** `coach-sidebar-nav.tsx` / `coach-nav-icons.tsx` stay (billing layout depends on them; out of scope).
