# ClearPath V2 — Site map (pages & API)

Single reference for **App Router pages** and high-level **API** areas. Regenerate or edit when you add routes.

## Public (unauthenticated)

| Path | Purpose |
|------|---------|
| `/` | Entry: redirects to `/login` if signed out; otherwise coach → dashboard or onboarding, client → portal |
| `/login` | Coach + client sign-in |
| `/signup` | New coach signup |
| `/client-login` | Client portal sign-in |
| `/forgot-password` | Password reset request |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/auth/set-password` | Set password (invite / reset flow) |

## Onboarding (coach, incomplete workspace)

| Path | Step |
|------|------|
| `/onboarding` | Workspace name, avatar, logo |
| `/onboarding/step-2` | Coaching types + client count |
| `/onboarding/step-3` | Invite first client (skippable) |
| `/onboarding/step-4` | Quick links + finish → dashboard |

## Coach app (`/coach/*`)

| Path | Purpose |
|------|---------|
| `/coach/dashboard` | Home |
| `/coach/clients` | Client list |
| `/coach/clients/[id]` | Client detail |
| `/coach/schedule` | Calendar + availability |
| `/coach/programs` | Programs |
| `/coach/programs/[id]` | Program builder |
| `/coach/videos` | Video library |
| `/coach/messages` | Messaging |
| `/coach/packages` | Session packages |
| `/coach/invoices` | Invoices |
| `/coach/payments` | Payments |
| `/coach/analytics` | Analytics |
| `/coach/assignments` | Assignments |
| `/coach/settings` | Settings |
| `/coach/suspended` | Workspace suspended state |

## Client app (`/client/*`)

| Path | Purpose |
|------|---------|
| `/client/portal` | Client home |
| `/client/dashboard` | Alternate entry (if used) |
| `/client/messages` | Messages |
| `/client/programs` | Programs |
| `/client/programs/[id]` | Program view |
| `/client/sessions` | Sessions |
| `/client/assignments` | Assignments |
| `/client/invoices` | Invoices |
| `/client/profile` | Profile |
| `/client/change-password` | Required password change |

## Billing (coach)

| Path | Purpose |
|------|---------|
| `/billing` | Subscription / Stripe portal |

## Admin (`/admin/*`, `ADMIN_EMAIL` only)

| Path | Purpose |
|------|---------|
| `/admin` | Admin entry |
| `/admin/not-authorized` | Shown when signed in but not admin |
| `/admin/overview` | Overview |
| `/admin/coaches` | Coaches / workspaces |
| `/admin/coaches/[workspaceId]` | Workspace detail |
| `/admin/clients` | Clients |
| `/admin/subscriptions` | Subscriptions |
| `/admin/revenue` | Revenue |
| `/admin/audit` | Audit |
| `/admin/errors` | Error logs |
| `/admin/settings` | Admin settings |
| `/admin/system` | System |

## API (summary)

All under `/api/*` — see `_docs/09-api-routes.md` for the full map. Groups include:

- **Auth** — `/api/auth/login`, `signup`, `session`, `set-password`, `signup-complete`, `dev-clear-session` (POST, **development only** — clears session for role-switch testing)
- **Coach data** — clients, sessions, programs, videos, messages, invoices, packages, payments, assignments, availability, analytics, settings
- **Client data** — programs, sessions, messages, assignments, invoices, rewards, weekly-unavailability, workspace-branding
- **Admin** — `/api/admin/*`
- **Webhooks** — Stripe, CloudConvert, n8n/video, etc.

## Source layout (where pages live)

```
app/
  (auth)/          → login, signup, client-login, forgot-password, legal
  (coach)/         → coach shell + /coach/* pages
  (client)/        → client shell + /client/* pages
  admin/           → admin routes (+ not-authorized)
  onboarding/      → onboarding wizard
  billing/         → billing
  api/             → route handlers
  page.tsx         → `/` root
```

When you add a page, update this file and `_docs/09-api-routes.md` if you add APIs.
