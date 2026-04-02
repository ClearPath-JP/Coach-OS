# ClearPath Coach OS

The complete operating system for professional coaches.

## What's included

- Client management with invite flow and client portal
- Real-time messaging and coach **broadcast** messages
- Drag-and-drop calendar, recurring availability, **weekly unavailability**, session booking
- **Coach iCal feed** (tokenized) and client session feed
- Program builder (modules, content, progress) and **assignments** with **XP / rewards**
- **Goals** and **goal updates**; **daily client check-ins**
- **Testimonials** (submit, approve, public flag) and **re-engagement** automation hooks
- Session **notes**, **shared summary**, **action items** (client can check off assigned items)
- Video library: **Google Drive import** and **in-app streaming** (signed tokens; no n8n required for playback)
- Session packages, invoicing, **Stripe Connect** checkout for client payments, SaaS billing for coaches
- Analytics dashboard, **revenue vs last month**, **attention-needed** insights, program completion celebration
- **Super-admin panel** (workspaces, coaches, subscriptions, revenue, audit, errors, system)
- White-label branding, **dark mode**, **8 color themes**
- Multi-tenant: many coaches/workspaces on one Supabase project (RLS-isolated)

## Tech stack

- Next.js 16 (App Router)
- Supabase (database, auth, storage, realtime)
- Stripe (billing and payments)
- Vercel (deployment)
- TypeScript + Tailwind CSS

## Quick start (template buyers)

### Prerequisites

- Node.js 18+
- pnpm (installed via corepack)
- Supabase account (supabase.com)
- Stripe account (stripe.com)
- Vercel account (vercel.com)

### Setup

1. Clone the repository

   ```bash
   git clone [your-repo-url]
   cd clearpath-v2
   ```

2. Install dependencies

   ```bash
   corepack enable
   corepack pnpm install
   ```

3. Copy environment variables

   ```bash
   cp .env.example .env.local
   ```

   Fill in all values in `.env.local`.

4. Link Supabase

   ```bash
   npx supabase link --project-ref [your-ref]
   npx supabase db push
   ```

5. Run the setup wizard

   ```bash
   corepack pnpm run setup
   ```

6. Start the development server

   ```bash
   corepack pnpm run dev
   ```

7. Open http://localhost:3000

### Deploy to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions.

## Development

### Commands

| Command | Description |
|--------|-------------|
| `pnpm run dev` | Start dev server (Next.js 16) |
| `pnpm run build` | Production build |
| `pnpm run test` | Run all tests (**59** cases, **8** suites under `__tests__/`) |
| `pnpm run lint` | ESLint |
| `pnpm run setup` | First-time setup wizard |
| `pnpm run seed:demo` | Add demo data (demo@clearpath.com workspace) |
| `pnpm run reset:demo` | Remove demo data |
| `pnpm run create:demo` | Create demo coach workspace (`scripts/create-demo-coach.ts`) |
| `pnpm run setup:admin` | Create/promote super admin (`CLEARPATH_ADMIN_*` in `.env.local`; then `/login` → `/admin`) |
| `pnpm run wipe:dev` | **Dev only:** delete all workspaces + all Auth users (`CLEARPATH_DEV_WIPE_CONFIRM` — see `.env.example`) |
| `pnpm run seed:test-client` | One test client for demo coach (`coach@example.com` workspace); run after `create:demo` |

**Minimal dev accounts (clean Supabase):** use **three different emails** — admin cannot share an account with coach. Set `CLEARPATH_DEV_WIPE_CONFIRM=DELETE_ALL_APP_DATA`, run `pnpm run wipe:dev`, then `setup:admin` → `create:demo` → `seed:test-client`. Logins: admin from `CLEARPATH_ADMIN_*`; coach `coach@example.com` / `Demo123!`; client `client@example.com` / `ClientDemo123!` (override with `CLEARPATH_TEST_*` vars).
| `pnpm run db:push` | Apply migrations |
| `pnpm run db:status` | Check migration status |

### Project structure

| Path | Purpose |
|------|---------|
| `app/` | Next.js app router pages |
| `app/(auth)/` | Login, signup, client login |
| `app/(coach)/` | Coach dashboard and features |
| `app/(client)/` | Client portal |
| `app/api/` | API route handlers |
| `components/` | Shared UI components |
| `components/ui/` | Base components |
| `components/layout/` | Navigation and layout |
| `components/coach/` | Coach-specific components |
| `components/client/` | Client-specific components |
| `lib/` | Utilities and helpers |
| `supabase/migrations/` | Database migrations |
| `scripts/` | Setup and seed scripts |
| `_docs/` | Project documentation |
| `_design/` | Design system docs |

## Business model options

### Option 1 — SaaS

Deploy once, all coaches share your Supabase instance, isolated by workspace. Charge coaches monthly via Stripe.

### Option 2 — Template

Sell this codebase. Buyers run their own Supabase and Vercel. One-time payment.

### Option 3 — Done for you

You set up a fresh installation for each coach using `pnpm run setup`. They pay setup fee + monthly hosting.

## Support

[docs.clearpath.com](https://docs.clearpath.com)
