# Redesign Plan 2 — Command Rail Dashboard

> **For agentic workers:** Execute task-by-task (superpowers:executing-plans). Steps use `- [ ]`. This is a self-executed inline plan: full component bodies are authored at execution (the committed source is the record); this doc is the blueprint — structure, data, and decisions.

**Goal:** Transform the coach dashboard into the "Command Rail" cockpit from the approved mockup — KPIs + a wide Today column + an always-visible right rail (attention · messages · quick actions).

**Architecture:** Keep the existing client component `CoachDashboardHome` as the orchestrator (data fetching + layout). Harvest the today/next/unread logic from the dead `CoachDashboardContent`. Extract the new presentational widgets into one focused file. Add a `.gloss-panel` surface utility. Greeting needs the coach's name → `page.tsx` becomes an async server component that passes it down.

**Tech stack:** Next 16 App Router (server `page.tsx` → client `CoachDashboardHome`), TS, Tailwind v4, date-fns (already a dep), inked `Icon` set (Plan 1). **Zero new deps.**

**Verification model:** `npx tsc --noEmit` clean per task; final `npm run build` (stop dev first); browser checkpoint vs `.superpowers/brainstorm/.../dashboard-layout.html` (Option A). Logic helper (today/next/unread compute) is pure → gets a Jest test in Task 3.

**Data sources (all exist, shapes confirmed from current code):**
- `GET /api/coach/dashboard-summary` → `{ data: { activeClientsCount, sessionsThisWeek, revenueMonthCents, revenuePrevMonthCents, pendingInvoicesCount, trends } }`
- `GET /api/coach/dashboard-attention` → `{ data: { inactive[], overdue[], unpaidInvoices: [{ id, amountCents, firstName, lastName }] } }`
- `GET /api/coach/sessions?from=<ISO>&to=<ISO>` → `{ data: SessionRow[] }`, `SessionRow = { id, scheduled_time, end_time, duration_minutes, status, session_type?, clients: { first_name, last_name } | null }`
- `GET /api/messages/conversations` → `{ data: ConversationRow[] }`, `ConversationRow = { clientId, fullName, lastMessagePreview, lastMessageAt, unreadCount, hasMessages }`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `app/globals.css` | `.gloss-panel` raised glossy surface utility | **Modify** |
| `app/coach/dashboard/dashboard-widgets.tsx` | Presentational widgets: `GreetingBar`, `TodayPanel`, `MessagesPeek`, `QuickActions` | **Create** |
| `app/coach/dashboard/dashboard-data.ts` | Pure helpers: `todayRows`, `nextSession`, `messageRows`, `unreadTotal` (testable) | **Create** |
| `app/coach/dashboard/dashboard-data.test.ts` | Jest tests for the pure helpers | **Create** |
| `app/coach/dashboard/CoachDashboardHome.tsx` | Orchestrator: fetch + compute + Command Rail layout. Keeps `StatCard`, `AttentionStrip` (evolved from `AttentionBanner`), `GettingStarted`. Drops the old "Jump to" tiles. | **Modify (rewrite)** |
| `app/coach/dashboard/page.tsx` | Async server: fetch `profiles.full_name`, pass `coachName` | **Modify** |

---

## Task 1: `.gloss-panel` utility

**Files:** Modify `app/globals.css` (append after the `.gloss-glass` block).

- [ ] **Step 1: Add the utility**

```css
/* Glossy raised content panel (used by dashboard + page panels). */
.gloss-panel {
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-subtle);
}
html[data-theme='dark'] .gloss-panel {
  border-color: var(--border-default);
  border-top-color: rgba(255, 255, 255, 0.06);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0) 32%),
    linear-gradient(180deg, #161310, #100e0b);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 14px 30px -18px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → PASS (CSS-only; sanity). Commit: `style(dashboard): gloss-panel surface utility`.

---

## Task 2: Pure data helpers + tests

**Files:** Create `dashboard-data.ts` + `dashboard-data.test.ts`.

- [ ] **Step 1:** Author `dashboard-data.ts` with pure functions (no React), operating on the API row types:
  - `todayRows(sessions: SessionRow[], now: Date): { id, time, title, sub }[]` — filter `isSameDay(parseISO(scheduled_time), now)`, sort ascending, map to `{ time: format(h:mm a), title: client full name || 'Client', sub: session_type || 'Session' }`.
  - `nextSession(sessions, now): { name, time } | null` — first today session with `scheduled_time > now`.
  - `messageRows(convos: ConversationRow[], limit = 3): { clientId, name, preview, unread }[]`.
  - `unreadTotal(convos): number` — sum of positive `unreadCount`.
  - Export the `SessionRow` / `ConversationRow` types here (single source; widgets + orchestrator import them).

- [ ] **Step 2:** Author `dashboard-data.test.ts` — Jest tests with fixed `now` (e.g. `new Date('2026-06-02T17:00:00')`) and sample rows: today-filtering, ascending sort, next-session selection (skips past, picks first future), unread sum, message limit. Real assertions, no placeholders.

- [ ] **Step 3:** Run: `npm test -- dashboard-data` → PASS. (If the jest config needs the path form, use `npx jest dashboard-data`.)

- [ ] **Step 4:** `npx tsc --noEmit` → PASS. Commit: `feat(dashboard): pure today/next/unread helpers + tests`.

---

## Task 3: Widgets + Command Rail orchestrator

**Files:** Create `dashboard-widgets.tsx`; rewrite `CoachDashboardHome.tsx`; modify `page.tsx`.

- [ ] **Step 1: `dashboard-widgets.tsx`** — `'use client'`, presentational only (props in, no fetching). Uses `Icon` from `@/components/icons/inked`, `Link`, `formatCents`.
  - `GreetingBar({ coachFirst, dateLine, next })` — `font-display` greeting ("Good morning/afternoon/evening, {coachFirst}" — greeting word passed in or computed from a passed `hour`), brass-dim uppercase `dateLine`, optional "Next: **{name}** at {time}", and a brass-gloss **Book a session** `Link` → `/coach/schedule` (reuse the brass CTA recipe: gradient `--accent-hover → --accent → --accent-dark`, inset highlight, brass glow).
  - `TodayPanel({ items })` — `.gloss-panel`; header row "Today · {n} sessions" + "View schedule ›" link; list rows (brass `font-display` time, primary name, tertiary sub) divided by hairlines; empty state "No sessions today" + "Book one" link.
  - `MessagesPeek({ items, unreadTotal })` — `.gloss-panel`; header "Messages" + "{n} unread"; up to 3 rows (name + truncated preview + brass unread dot when `unread>0`); footer link "All messages ›" → `/coach/messages`; empty "All caught up".
  - `QuickActions()` — three `.gloss-panel`-less chips (bordered) in a row: Book (`schedule` icon → `/coach/schedule`), Message (`messages` → `/coach/messages`), Payment (`payments` → `/coach/payments`); inked icons in brass.

- [ ] **Step 2: Rewrite `CoachDashboardHome.tsx`** — `'use client'`, signature `CoachDashboardHome({ coachName }: { coachName: string })`.
  - **Keep:** `StatCard` + `TrendIcon`, `GettingStarted`, the loading-skeleton + error-retry states, the 4 KPIs (Active clients · Sessions this week · Revenue (month) · Pending invoices) with trends.
  - **Evolve `AttentionBanner` → `AttentionStrip`:** same logic, but sum `unpaidInvoices[].amountCents` and show "{n} unpaid invoices · {formatCents(total)}" linking to `/coach/invoices`; keep the inactive-clients line. Render it in the rail.
  - **Drop:** the old `NAV_TILES` "Jump to" block (navigation now lives in the sidebar + ⌘K).
  - **Data:** extend `fetchAll` to also `fetch('/api/coach/sessions?from=<weekStart>&to=<weekEnd>')` and `fetch('/api/messages/conversations')` (use `startOfWeek`/`endOfWeek`, `weekStartsOn: 1`, like `CoachDashboardContent`). Store `sessions` + `conversations` in state; tolerate failures (`.catch(() => [])`).
  - **Compute (via `dashboard-data.ts`):** `todayRows`, `nextSession`, `messageRows`, `unreadTotal`. `coachFirst = coachName.trim().split(/\s+/)[0] || 'Coach'`; `dateLine = format(now, 'EEEE · MMMM d')`; greeting word from `now.getHours()`.
  - **Layout (replaces the old return):**
    ```
    <div className="coach-dash-stagger flex flex-col gap-6">
      <GreetingBar … />
      {KPI row — unchanged loading/error/stat markup}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">  {/* main */}
          <TodayPanel items={todayItems} />
          {!loading && !error && <GettingStarted stats={s} programsCount={badges.programsCount} />}
        </div>
        <div className="flex flex-col gap-4">  {/* rail */}
          {!loading && !error && <AttentionStrip attention={attention} pendingInvoicesCount={s.pendingInvoicesCount} />}
          <MessagesPeek items={messageItems} unreadTotal={unread} />
          <QuickActions />
        </div>
      </div>
    </div>
    ```
  - Keep the 15s abort + retry. The header "Command Center" `<h1>` is replaced by `GreetingBar`.

- [ ] **Step 3: `page.tsx`** — make it an async server component: `createClient()` → `auth.getUser()` → `profiles.select('full_name')`; `coachName = full_name || email prefix || 'Coach'`; `return <CoachDashboardHome coachName={coachName} />`. (Mirror the existing dead `CoachDashboardWithProfile` pattern.)

- [ ] **Step 4:** `npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit** — `feat(dashboard): Command Rail layout — greeting, today, messages, quick actions`.

---

## Task 4: QA

- [ ] **Step 1:** `npx tsc --noEmit` → PASS.
- [ ] **Step 2:** Stop dev server, `npm run build` → `BUILD_EXIT:0`, restart dev.
- [ ] **Step 3: Browser checkpoint** (demo coach, `/coach/dashboard`): greeting + date + next-session; 4 KPIs with trends; Today panel (today's sessions or empty state); right rail with attention ($ total), messages peek (unread dots), quick actions. Compare to mockup A. Reduced-motion: stagger respects it (existing `.coach-dash-stagger` already gated).
- [ ] **Step 4:** Confirm no `dashboard-summary`/data regressions (KPIs still populate).

---

## Self-review
- **Spec coverage (§6.1):** greeting/next → GreetingBar; KPIs+trends → kept; Today inline → TodayPanel; actionable attention → AttentionStrip ($ total); messages peek → MessagesPeek; quick actions → QuickActions; dead cinematic dashboard already noted for removal (separate cleanup — not blocking; `CoachDashboardContent`/`WithProfile` can be deleted in QA if unreferenced).
- **Types:** `SessionRow`/`ConversationRow` defined once in `dashboard-data.ts`, imported by widgets + orchestrator.
- **Data:** all four endpoints already exist and are already partly used by the live dashboard.
