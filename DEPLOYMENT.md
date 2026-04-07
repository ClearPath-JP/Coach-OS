# Deploying ClearPath Coach OS

## Prerequisites

Complete [README.md](./README.md) setup first.

## Step 1 — Supabase production setup

1. Create a new Supabase project at [supabase.com](https://supabase.com) (use Pro plan for daily backups — $25/month).
2. Go to Settings → API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to Authentication → URL Configuration. Set Site URL to: `https://app.clearpath.com`. Add redirect URL: `https://app.clearpath.com/auth/callback`
4. Link and push migrations:

   ```bash
   npx supabase link --project-ref [ref]
   npx supabase db push
   ```

5. Go to Storage and confirm buckets exist (migrations create `videos`, `assignment-submissions`, and related policies; create manually if an older DB skipped them):
   - `avatars`
   - `programs`
   - `workspaces`
   - `videos` (coach / pipeline video files)
   - `assignment-submissions` (client assignment video uploads)

6. **Connection pooling (recommended for production):** In Supabase Dashboard → **Settings** → **Database**, enable the **connection pooler** (Supavisor / PgBouncer). Use **Transaction** mode for serverless hosts (e.g. Vercel) so many concurrent coaches do not exhaust direct Postgres connections. The app uses the Supabase REST API by default; pooling still protects the database under load.

## Step 2 — Stripe production setup

1. Go to [stripe.com](https://stripe.com) → Developers → API Keys → copy live keys.
2. Create products and prices:
   - Starter: $79/month
   - Pro: $149/month
   - Scale: $299/month
3. Set up webhook endpoint:
   - URL: `https://app.clearpath.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Step 3 — Google Cloud production setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create an **OAuth 2.0 Client ID** (Web application) with the Google Drive API enabled.
3. Add **Authorized redirect URI**: `https://app.clearpath.com/api/integrations/google-drive/callback` (and your Vercel preview URL + `/api/integrations/google-drive/callback` if you test previews).
4. Copy **Client ID** and **Client Secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel (and `.env.local`).
5. Update `GOOGLE_REDIRECT_URI` / `GOOGLE_DRIVE_REDIRECT_URI` in Vercel env vars to match the deployed app URL if you override the default.

### Video streaming env vars

- **`VIDEO_STREAM_TOKEN_SECRET`** — Set a long random string in production (same value in Vercel). Used to sign short-lived tokens for the video stream proxy so Range requests (scrubbing) work efficiently. Optional in local dev; **recommended in production**.

### Google Drive vs n8n

- Coaches connect Google Drive under **Settings → Integrations**. Imported videos use **Drive file metadata + in-app streaming**; **n8n is not required** for playback or for the Drive import flow in the app.
- **n8n / CloudConvert** remain optional if you use legacy automation or transcoding pipelines.

## Setting up Upstash Redis (required)

Rate limiting for auth pages and API routes uses Upstash Redis. Without `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, limits are disabled in production.

1. Go to [console.upstash.com](https://console.upstash.com).
2. Create an account (free tier works).
3. Click **Create Database**.
4. Name it `clearpath-rate-limiting` (or any name you prefer).
5. Select a region closest to your Vercel deployment.
6. Copy **REST URL** → set `UPSTASH_REDIS_REST_URL` in Vercel (and locally in `.env.local` if needed).
7. Copy **REST Token** → set `UPSTASH_REDIS_REST_TOKEN`.
8. Redeploy so the app picks up the variables.

Without Upstash, auth endpoints have no effective rate limiting in production. The free tier handles about 10,000 requests per day — enough for most launches.

## Step 4 — Deploy to Vercel

> **IMPORTANT:** Set `ADMIN_EMAIL=jpotesta15@outlook.com` in the Vercel project environment variables **before** deploying. Without this value the admin panel will not recognize your account and access checks will fail.

1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) → New Project.
3. Import your GitHub repository.
4. Add all environment variables from `.env.example` (with production values), including Upstash Redis.
5. Set `NEXT_PUBLIC_APP_URL` to your production URL.
6. Deploy.

## Step 5 — Custom domain

1. In Vercel → Project → Settings → Domains.
2. Add: `app.clearpath.com`
3. Add: `clearpath.com` (for marketing site when ready)
4. Follow DNS instructions.

## Step 6 — Post-deployment checklist

Run through this after every deployment:

**Database:**

- [ ] All migrations applied (`db:status`)
- [ ] RLS enabled on all tables
- [ ] Storage buckets created

**Auth:**

- [ ] Supabase redirect URLs updated
- [ ] Email templates configured in Supabase
- [ ] Test signup flow end to end

**Payments:**

- [ ] Stripe webhook receiving events
- [ ] Test payment with Stripe test card
- [ ] Switch to live keys for production

**Features:**

- [ ] Test coach signup → onboarding → dashboard
- [ ] Test client invite → portal access
- [ ] Test messaging real-time
- [ ] Test video import from Google Drive (n8n not required for playback)
- [ ] Test calendar booking
- [ ] Dark mode toggle works
- [ ] Color themes save correctly

**Performance:**

- [ ] Run Lighthouse audit (aim for 90+)
- [ ] Check page load times
- [ ] Verify images are optimized

**Security:**

- [ ] No `.env.local` committed to git
- [ ] `.gitignore` includes `.env.local`
- [ ] Service role key NOT in client code
- [ ] Rate limiting active on auth endpoints (Upstash Redis configured)

## Setting up uptime monitoring (free)

1. Go to [uptimerobot.com](https://uptimerobot.com).
2. Create a free account.
3. Add a new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://app.clearpath.com/api/health` (replace with your production app URL if different)
   - **Interval:** 5 minutes
4. Add your email for alerts.

You will be notified if the app stops returning a healthy response. The health endpoint returns JSON `{ status, timestamp }` and requires no authentication.

---

## Environment variables (production checklist)

Copy from [`.env.example`](./.env.example) and set in Vercel. Critical additions for newer features:

| Variable | Purpose |
|----------|---------|
| `VIDEO_STREAM_TOKEN_SECRET` | HMAC secret for short-lived video stream tokens (`lib/stream-token.ts`) |
| `EMAIL_FROM_DEFAULT` | Verified Resend from-address (`lib/notifications/messages.ts`) |
| `STRIPE_CONNECT_DEFAULT_COUNTRY` | Default Connect country (e.g. `US`) |
| `N8N_SESSION_REMINDER_ON_DEMAND_URL` | Optional: coach “send reminder” forwards here |
| `N8N_SESSION_BOOKED_WEBHOOK_URL` | Optional: session-booked / test hooks |

Also required: Supabase keys, Stripe API + webhook secret + **price IDs**, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, Upstash Redis, `ADMIN_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY` (server only).

---

## Storage buckets

Confirm buckets exist (migrations create policies; create buckets in Dashboard if an old DB skipped them):

- **`avatars`** — coach/client photos  
- **`programs`** — program uploads  
- **`videos`** — library / pipeline video objects  
- **`assignment-submissions`** — client assignment uploads  

Optional: **`workspaces`** — workspace assets (if used by your deployment).

---

## Migrations (run in order)

Apply with `npx supabase db push` (or CI) after `supabase link`. Filenames are timestamp-prefixed; **run all** in lexical order. Summary by file:

| Migration | Description |
|-----------|-------------|
| `20240315000000_create_base_tables` | Base tables: profiles, clients, programs, lessons, videos, sessions, messages, payments, etc. |
| `20240315000001_create_workspaces` | `workspaces` tenant root |
| `20240315000002_create_coaches` | `coaches` ↔ auth users |
| `20240315000003_add_workspace_id_to_all_tables` | Workspace FKs on tenant tables |
| `20240315000004_current_workspace_id_function` | RLS helper |
| `20240315000005_rls_workspace_policies` | Workspace RLS |
| `20240315000006_drop_legacy_tenant_columns` | Remove legacy tenant columns |
| `20240316000001_clients_v2_columns` | Clients v2 shape |
| `20240316000002_messages_update_read_at` | Message read tracking |
| `20240316000003_messages_client_id_and_rls` | Messages + client RLS |
| `20240316000004_workspaces_onboarding_columns` | Onboarding fields |
| `20240316000005_recurring_availability_and_sessions_columns` | Recurring availability + session columns |
| `20240316000006_subscriptions_billing` | Subscriptions + Stripe webhook idempotency |
| `20240316000007_session_packages_invoices` | Packages + invoices |
| `20240316000008_programs` | Modular programs + progress |
| `20240316000009_videos` | Video pipeline columns + `google_drive_connections` |
| `20240316000010_settings` | Workspace/profile settings columns |
| `20240316000011_payments_analytics` | Payment analytics |
| `20240316000012_realtime_videos` | Realtime for videos |
| `20240316000013_workspace_import_folder` | `google_drive_import_folder_id` |
| `20240318000000_videos_storage_bucket` | Video storage bucket policies |
| `20240323000000_videos_category` | Video category |
| `20240324000013_realtime_messages` | Realtime messages |
| `20240324000014_white_label` | White-label columns |
| `20240325000015_profiles_logo_url` | Profile logo |
| `20240326000015_audit_logs` | Audit logs |
| `20240326000016_performance_indexes` | Indexes |
| `20240326000017_sessions_session_type` | Session type |
| `20240327000017_payment_methods_settings` | Payment method prefs |
| `20240327000018_admin_role` | `is_super_admin` |
| `20240327000019_admin_workspace_status_policies` | Admin policies + workspace status |
| `20240328000019_assignments` | Assignment templates, client assignments, submissions, rewards |
| `20240328000020_frontend_error_logs` | Frontend error logging table |
| `20240328000021_current_workspace_id_profiles_first` | RLS helper tweak |
| `20240328000022_avatars_storage_public_read` | Avatar storage |
| `20240328000023_weekly_unavailability` | Weekly unavailability |
| `20240328000024_session_packages_is_virtual` | Virtual session flag |
| `20240329000025_workspaces_admin_notes` | Admin notes on workspace |
| `20240329000026_clients_rls_workspace_owner` | Client RLS refinement |
| `20240329000027_assignments_rls_workspace_owner` | Assignment RLS refinement |
| `20260401000000_videos_drive_stream_columns` | Drive streaming columns on `videos` |
| `20260401120000_videos_drive_metadata_columns` | Drive metadata on `videos` |
| `20260401140000_assignment_submissions_bucket_and_video_uploader` | Submissions bucket + client uploader |
| `20260401160000_idx_client_assignments_workspace_status` | Assignment indexes |
| `20260401180000_videos_uploaded_by_client_on_delete_cascade` | Client upload FK behavior |
| `20260401200000_workspaces_stripe_connect_account` | Stripe Connect on workspace |
| `20260401210000_workspace_coach_calendar_feed_token` | Coach iCal token on workspace |
| `20260402000000_missing_performance_indexes` | Extra indexes |
| `20260402001000_get_coach_conversations_rpc` | Messaging RPC |
| `20260402003000_coach_dashboard_attention_rpcs` | Dashboard attention RPCs |
| `20260403000001_stripe_webhook_events_rls` | Webhook events RLS |
| `20260403000010_client_goals` | Goals + goal updates |
| `20260403000011_testimonials` | Testimonials + auto check-in columns + re-engagement RPC |
| `20260404000001_daily_checkins` | Daily check-ins |
| `20260405000000_sessions_structured_notes` | Session notes, summary, action items |

**Total:** 55 migration files as of 2026-04-02.

---

## Post-deploy scripts

After first production deploy (and whenever you onboard a platform operator):

1. `corepack pnpm run setup:admin` — promote `ADMIN_EMAIL` to super admin (see script + `.env.example`).
2. Optionally `corepack pnpm run create:demo` / `seed:demo` on a **non-production** project only.

Never run `wipe:dev` against production.
