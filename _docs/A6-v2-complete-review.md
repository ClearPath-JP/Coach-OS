# ClearPath V2 — Complete build review

**Last updated:** 2026-04-02

## What was built

### Phase 1 — Foundation

- Multi-tenant workspace architecture (`workspaces`, `coaches`, `workspace_id` on tenant data)
- Supabase RLS on workspace-scoped tables (`current_workspace_id()` pattern)
- Route protection via **`proxy.ts`** (Next.js 16 middleware entry — do not add root `middleware.ts`)
- Design system (CSS variables, typography, spacing) and base UI components

### Phase 2 — Core features

- Client management and invite flow
- Client portal
- Coach onboarding wizard
- Real-time messaging
- Calendar with drag-and-drop scheduling and recurring availability
- Billing with Stripe subscriptions (coach SaaS plans)

### Phase 3 — Power features

- Session packages and invoicing (manual + Stripe)
- Program builder (modules, content, progress)
- Video library: Google Drive import, **in-app streaming** (signed tokens, Range requests), optional n8n/CloudConvert for legacy automation
- Analytics dashboard (revenue, activity, **revenue trend vs last month**)
- Settings: white-label branding, integrations
- Dark mode and **8 color themes**

### Phase 4 — Value and polish (post–session 20)

- **Admin panel** — workspace overview, coaches, subscriptions, revenue, audit, error logs, system health, magic links, trial extension, exports
- **Assignment system** — templates, client assignments, submissions, **XP and rewards** (`client_rewards`, levels, streaks)
- **Goal tracking** — `client_goals`, `client_goal_updates` with coach/client RLS
- **Testimonial collection** — client submit, coach approve/public flags, program-completion prompts
- **Re-engagement automation** — workspace auto check-in settings, inactive-client RPC, coach-triggered flow
- **Broadcast messaging** — coach → all clients (uses existing messaging/broadcast pipeline)
- **Client engagement scores** and **Attention needed** dashboard section (RPC-backed)
- **Quick invoice modal** and **program completion celebration** UX
- **Coach iCal feed** — tokenized `GET /api/calendar/feed/coach` (workspace `coach_calendar_feed_token`)
- **Stripe Connect** — client invoice checkout to coach connected account (`workspaces.stripe_connect_account_id`)
- **Session notes** — `coach_private_notes`, `session_summary`, `action_items` JSON, `notes_sent_at`; client visibility APIs
- **Daily client check-in** — mood/energy/note, one per day per client (`daily_checkins`)
- **Security hardening** — admin RLS, rate limits, session fingerprinting for coaches (target maturity **~8/10**)
- **Performance** — indexes, dashboard RPCs, caching helpers (target **~7.5/10**)

---

## Technical stats (from repo / build)

| Metric | Value |
|--------|--------|
| **App routes** | **134** static page generations in `next build`; additional dynamic segments (e.g. `[id]`) extend surface area |
| **API route modules** | **139** files under `app/api/**/route.ts` (~**130+** logical HTTP endpoints; many routes expose GET+POST+PATCH) |
| **Database tables** | **~50** public tables in migrations (core + programs + assignments + goals + testimonials + check-ins + audit/logs + Drive, etc.) |
| **Tests** | **59** automated tests in **8** Jest suites under `__tests__/` (`pnpm run test`) |
| **Migrations** | **55** SQL files in `supabase/migrations/` |
| **Stack** | Next.js **16** (App Router), React 19, Supabase, Stripe, Vercel, TypeScript, Tailwind 4 |

---

## Known limitations for V2

- **SaaS billing** still requires Stripe live/test keys and correct price IDs; failed webhooks need monitoring
- **Email** requires Resend (and verified `EMAIL_FROM_DEFAULT`)
- **Google Drive** requires OAuth client setup and (for production) appropriate Google verification if using sensitive scopes
- **Rate limiting** on Vercel requires Upstash Redis (`UPSTASH_*`); without it, limits are degraded
- **Mobile**: complex coach/admin flows are desktop-oriented; client portal is mobile-first
- **Multi-coach workspaces**: single primary coach per workspace is the happy path; team coaching is not first-class yet
- **Client profile columns**: some validations historically referenced fields not on `clients`; see `02-database-schema.md` gaps

---

## Recommended next features (V3)

- Resource library for clients (downloads, links)
- Progress journal (long-form client reflections)
- Package bundles and installment payments
- Group coaching sessions
- Public coach profile / marketing page (beyond internal `coach_profiles`)
- Daily habit tracker (streaks separate from assignments)
- Progress photos (storage + privacy controls)
- Monthly PDF progress report
- Mobile app (React Native)
- Zapier / outbound webhooks
- AI session notes summary
- Waiting list automation

*(Remove from this list when shipped.)*

---

## Architecture decisions

- **Two repos:** ClearPath-V2 (app) and marketing site (separate; not in this repo)
- **One Supabase project** for multi-tenant SaaS; isolation by `workspace_id` + RLS
- **Video playback:** Google Drive file metadata + **stream proxy** in-app; **no requirement to download full file to client**; n8n optional for older transcode flows
- **Stripe:** platform subscription for coaches; **Connect** for end-client invoice payments where enabled
- **Middleware:** implemented in **`proxy.ts`** per Next.js 16 conventions

---

## Deployment and QA

See [DEPLOYMENT.md](../DEPLOYMENT.md), [CHECKLIST.md](../CHECKLIST.md), and [_docs/03-env-variables.md](./03-env-variables.md).

---

## Business model

See [_docs/15-pricing-and-business-model.md](./15-pricing-and-business-model.md) and [README.md](../README.md) (SaaS vs template vs done-for-you).
