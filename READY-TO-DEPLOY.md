# Coach-OS — Pre-Deploy Checklist

## Environment Variables (set in Vercel dashboard)
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] SUPABASE_JWT_SECRET (from Supabase dashboard → Settings → API → JWT Settings)
- [ ] STRIPE_SECRET_KEY (live key, starts with `sk_live_`)
- [ ] STRIPE_WEBHOOK_SECRET (starts with `whsec_`)
- [ ] STRIPE_PRICE_STARTER_ID
- [ ] STRIPE_PRICE_PRO_ID
- [ ] STRIPE_PRICE_SCALE_ID
- [ ] STRIPE_SETUP_FEE_STARTER_ID (one-time fee price ID, or leave blank if not using)
- [ ] STRIPE_SETUP_FEE_PRO_ID
- [ ] STRIPE_SETUP_FEE_SCALE_ID
- [ ] STRIPE_CONNECT_DEFAULT_COUNTRY (e.g. `US`)
- [ ] RESEND_API_KEY
- [ ] EMAIL_FROM_DEFAULT (must be a verified domain in Resend, e.g. `ClearPath <noreply@yourdomain.com>`)
- [ ] UPSTASH_REDIS_REST_URL
- [ ] UPSTASH_REDIS_REST_TOKEN
- [ ] VIDEO_STREAM_TOKEN_SECRET (any random 32+ char string — run `openssl rand -hex 32`)
- [ ] ADMIN_EMAIL (the email you sign in with for super-admin access)
- [ ] GOOGLE_CLIENT_ID (for Drive integration)
- [ ] GOOGLE_CLIENT_SECRET
- [ ] GOOGLE_REDIRECT_URI (set to `https://yourdomain.com/api/integrations/google-drive/callback`)
- [ ] N8N_CALLBACK_SECRET (if using n8n automation)
- [ ] N8N_SESSION_REMINDER_ON_DEMAND_URL (optional)
- [ ] N8N_SESSION_BOOKED_WEBHOOK_URL (optional)
- [ ] N8N_VIDEO_WEBHOOK_SECRET (optional)
- [ ] NEXT_PUBLIC_APP_URL (your production URL, e.g. `https://app.clearpath.com`)

## Supabase
- [ ] Create a production project at supabase.com (Pro plan recommended for daily backups)
- [ ] Run all migrations: `npx supabase link --project-ref [ref] && npx supabase db push`
- [ ] Confirm all 55 migrations applied: `npm run db:status`
- [ ] Enable connection pooling: Supabase dashboard → Settings → Database → Connection Pooling → Transaction mode
- [ ] Verify RLS is enabled on all tables (check in Table Editor → each table → RLS column)
- [ ] Set Site URL in Supabase: Authentication → URL Configuration → `https://yourdomain.com`
- [ ] Add redirect URL: `https://yourdomain.com/auth/callback`
- [ ] Confirm storage buckets exist: `avatars`, `programs`, `videos`, `assignment-submissions`
- [ ] Copy SUPABASE_JWT_SECRET from: Settings → API → JWT Settings

## Stripe
- [ ] Switch to live mode in Stripe dashboard
- [ ] Create 3 subscription products: Starter ($79/mo), Pro ($149/mo), Scale ($299/mo)
- [ ] Optionally create one-time setup fee prices for each tier
- [ ] Copy price IDs to STRIPE_PRICE_STARTER_ID / PRO / SCALE (and SETUP_FEE_ variants if used)
- [ ] Add webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Subscribe webhook to these events:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- [ ] Copy webhook signing secret to STRIPE_WEBHOOK_SECRET

## Resend (email)
- [ ] Add and verify your sender domain in Resend dashboard
- [ ] Set EMAIL_FROM_DEFAULT to an address on your verified domain
- [ ] Send a test email via `/admin` → Test Email after deploy

## Upstash Redis (rate limiting)
- [ ] Create a Redis database at console.upstash.com (free tier is sufficient for launch)
- [ ] Select a region closest to Vercel `iad1` (US East)
- [ ] Copy REST URL → UPSTASH_REDIS_REST_URL
- [ ] Copy REST Token → UPSTASH_REDIS_REST_TOKEN
- [ ] Without these, rate limiting on auth endpoints is disabled in production

## Google Drive (optional but recommended)
- [ ] Create OAuth 2.0 credentials in Google Cloud Console (Web application type)
- [ ] Enable Google Drive API in the project
- [ ] Add authorized redirect URI: `https://yourdomain.com/api/integrations/google-drive/callback`
- [ ] Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

## Video Stream Tokens
- [ ] Generate a secure random secret: `openssl rand -hex 32`
- [ ] Set as VIDEO_STREAM_TOKEN_SECRET in Vercel

## Admin Setup
- [ ] Set ADMIN_EMAIL to your login email before first deploy
- [ ] After first deploy, run: `npm run setup:admin` to promote your account to super admin
- [ ] Verify access at `https://yourdomain.com/admin`

## Vercel Deploy
- [ ] Connect GitHub repo to Vercel
- [ ] Set all env vars in Vercel dashboard (Settings → Environment Variables)
- [ ] Set NEXT_PUBLIC_APP_URL to your production domain (no trailing slash)
- [ ] Set framework to Next.js (auto-detected from vercel.json)
- [ ] Deploy — watch build logs for any missing env var errors
- [ ] After deploy, confirm health check: `curl https://yourdomain.com/api/health`
- [ ] Should return: `{"status":"ok","timestamp":"..."}`

## Custom Domain
- [ ] In Vercel → Project → Settings → Domains → add your domain
- [ ] Follow DNS instructions (CNAME or A record)
- [ ] Wait for SSL certificate to provision (usually < 2 minutes)

## Post-Deploy Verification
- [ ] Health endpoint returns `{"status":"ok"}`: `curl https://yourdomain.com/api/health`
- [ ] Log in as coach (ADMIN_EMAIL) — dashboard loads without errors
- [ ] Invite a test client — confirmation email arrives
- [ ] Book a session — appears on schedule
- [ ] Create a test invoice — Stripe checkout opens and completes
- [ ] Verify Stripe webhook received: Stripe dashboard → Developers → Webhooks → recent deliveries
- [ ] Check `/admin` — accessible with ADMIN_EMAIL account
- [ ] Test Google Drive connect (if using): Settings → Integrations
- [ ] Run Lighthouse audit on `/login` and `/coach/dashboard` (aim for 90+)

## Security Final Checks
- [ ] Confirm `.env.local` is NOT committed (`git status` should not show it)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` does not appear in any client-side bundle
- [ ] Rate limiting is active (Upstash Redis configured)
- [ ] HSTS header is set (verified via `curl -I https://yourdomain.com | grep Strict`)

## Uptime Monitoring (free)
- [ ] Set up a monitor at uptimerobot.com
  - Type: HTTP(s)
  - URL: `https://yourdomain.com/api/health`
  - Interval: 5 minutes
  - Alert: your email
