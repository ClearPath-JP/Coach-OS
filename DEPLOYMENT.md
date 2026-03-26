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

5. Go to Storage and create buckets:
   - `avatars` (private)
   - `programs` (private)
   - `workspaces` (private)

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
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Step 3 — Google Cloud production setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Add authorized redirect URI: `https://app.clearpath.com/api/integrations/google-drive/callback`
3. Update `GOOGLE_REDIRECT_URI` / `GOOGLE_DRIVE_REDIRECT_URI` in Vercel env vars to the production URL if you override the default.

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
- [ ] Test video import (if n8n configured)
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

You will be notified if the app stops returning a healthy response. The health endpoint returns JSON `{ status, version, timestamp }` and requires no authentication.
