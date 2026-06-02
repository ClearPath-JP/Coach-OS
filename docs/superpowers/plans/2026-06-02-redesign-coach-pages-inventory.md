# Coach Inner Pages — Redesign Inventory (grounding for Plan 3+)

Captured 2026-06-02 (read-only audit). Seeds Plan 3 (coach inner-page rollout). Dashboard, sidebar, ⌘K, mobile nav already redesigned (Plans 1–2) — excluded here.

## Page table

| Page | Main file(s) | ~Lines | PageHeader? | Panels | lucide icons | Pattern |
|---|---|---|---|---|---|---|
| `/coach/schedule` | `CoachSchedulePageClient` → `CoachScheduleWorkspace.tsx` | 825 | No (custom header) | ad-hoc sections, ScheduleTodayPanel, ScheduleWeekGrid | CalendarDays, CalendarPlus, ChevronLeft/Right, ClipboardList, Clock, DollarSign, Ticket, Users, Video | board/calendar |
| `/coach/classes` | `CoachClassesContent.tsx` | 513 | No (inline header) | ad-hoc `rounded-2xl border` | Plus, Loader2, Users, Calendar, Trash2, AlertTriangle | table/list |
| `/coach/clients` | `ClientsPageContent.tsx` | 700 | **Yes** | `card-interactive card-glow` cards / `DataTable`; `.empty-state-coach` | CalendarCheck, Flame, Star | table/list |
| `/coach/clients/[id]` | `ClientDetailContent.tsx` | 993 | No (breadcrumb banner) | `<Card variant="raised">` tabs | Flame | detail |
| `/coach/messages` | `MessagesPageContent.tsx` | 867 | No (fullscreen split) | raw flex; ConversationSidebar + ChatWindow | none (inline SVG) | composer |
| `/coach/programs` | `ProgramsPageContent.tsx` | 601 | **Yes** | `card-interactive card-glow` / list; `.empty-state-coach` | none (unicode toggles) | table/list |
| `/coach/programs/[id]` | `ProgramEditorContent.tsx` | 1576 | No (breadcrumb + steps) | raw `rounded-xl border` panels | 10 hand-rolled inline SVGs | detail/form |
| `/coach/packages` | `PackagesPageContent.tsx` | 548 | **Yes** | `<Card variant="raised">` grid; `.empty-state-coach` | Package | table/list |
| `/coach/memberships` | `MembershipsContent.tsx` | 845 | No (inline header) | ad-hoc `rounded-2xl border` strip + table | BadgeDollarSign, Loader2, Plus, Pencil, Trash2, X, Users, AlertTriangle | table/list |
| `/coach/payments` | `PaymentsPageContent.tsx` | 574 | **Yes** | `<Card variant="raised">` KPIs + DataTable; hero gradient Card | none | table/list |
| `/coach/invoices` | `InvoicesPageContent.tsx` | 448 | **Yes** | `<Card variant="raised">` + DataTable; `.empty-state-coach` | none | table/list |
| `/coach/analytics` | `AnalyticsPageContent.tsx` | 657 | **Yes** | `<Card variant="raised">` tabs | BarChart3 | charts |
| `/coach/promote` | `PromotePageContent.tsx` (+ steps) | 165 + ~900 | No (inline header) | ad-hoc `rounded-2xl border` | Megaphone, ArrowLeft, RotateCcw, Dumbbell | composer/wizard |
| `/coach/leads` | `CoachLeadsContent.tsx` | 993 | No (search header) | ad-hoc `rounded-xl border`; LeadsTable, LeadDetailDrawer | Search, Loader2, Trash2, AlertCircle, Sparkles, Dumbbell, MapPin, Users, ChevronDown/Up | table/list |
| `/coach/videos` | `VideosPageContent.tsx` | 1516 | **Yes** | `<Card>` storage strip + ad-hoc grid; `.empty-state-coach` | Video | table/list |
| `/coach/settings` | `SettingsPageContent.tsx` | 1224 | **Yes** | `<Card>` sections + inner tabs | none | form/settings |
| `/coach/settings/appearance` | `settings/appearance/page.tsx` | 648 | No (raw h1) | ad-hoc `rounded-[14px] border` (no Card) | none | form/settings |
| `/coach/subscription` | `SubscriptionPageContent.tsx` | 378 | **Yes** | `<Card>` tiers | BookOpen, CalendarDays, Check, CreditCard, HardDrive, Mail, MessageSquare, Search, Sparkles, Target, Users, Video, Wifi, Zap | form/settings |

## Inconsistencies to unify
- **Headers:** `PageHeader` (9) vs inline `<header>` (schedule, classes, memberships, promote) vs none (messages, clients/[id], programs/[id], settings/appearance, leads).
- **Panels:** `<Card variant="raised">` vs plain `<Card>` vs ad-hoc `rounded-2xl border` vs `rounded-[14px] border`. `.gloss-panel`/`.game-panel` only on dashboard.
- **Empty states:** `.empty-state-coach` (clients, programs, packages, invoices) vs ad-hoc dashed divs (classes, memberships).
- **Icons:** lucide vs hand-rolled SVG (programs editor ×10) vs unicode toggles.
- **Tabs:** the same `border-b after:h-0.5 after:bg-[var(--cp-accent)]` re-implemented in 8 pages — no shared `<Tabs>`.
- **Tokens:** old `--color-ink/-muted/-border/...` vs new `--text-*/--border-*/--bg-*` depending on file era.

## Shared primitives (build/evolve once → ripple)
- **A. `Card` → glossy:** apply the `.gloss-panel` treatment to `components/ui/Card.tsx` (raised/elevated). Ripples to clients/[id], analytics, packages, payments, invoices, subscription, settings, videos.
- **B. `PageHeader` + `icon` prop** (inked `<Icon>`), glossy underline. Lets schedule/classes/memberships/promote/leads adopt a uniform header.
- **C. `EmptyState` with inked ensō** — unify `.empty-state-coach` + ad-hoc empties.
- **D. `Tabs` primitive** — replace 8 hand-rolled tab strips.
- **E. Token normalization** — search/replace old `--color-*` → new tokens.
- **F. `StatCard`** (`components/dashboard/StatCard.tsx` exists) — standardize payments/analytics/memberships KPI strips.

## Batching (impact/risk order)
1. **List/table pages already on PageHeader:** clients, programs, packages, invoices, payments, videos — tokenize, StatCard, EmptyState, inked header icons.
2. **Need PageHeader adoption + panel unification:** classes, memberships, analytics, subscription.
3. **Complex interaction:** schedule, leads, promote.
4. **Settings + detail:** settings, settings/appearance, clients/[id], programs/[id], messages.
