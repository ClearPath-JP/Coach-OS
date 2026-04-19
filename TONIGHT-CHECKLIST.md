# Tonight Checklist — COACH-OS Ship to First Coach

**Objective:** By end of tonight, both Stripe (subscriptions + Connect) and the Google Drive video import pipeline are working end-to-end in production. Monday AM → demo booked with Combative Alchemy.

**Total time estimate:** ~1–2 hours (preflight showed most of your stack is already set up — see below).

**Execution order matters.** Each section depends on the previous. Don't skip ahead.

---

## 🟢 YOU ARE HERE — preflight run 2026-04-16 PM

Already configured in your `.env.local` (mirror to Vercel if not already there):

- ✅ Supabase URL + anon key + service role
- ✅ Stripe secret key (**LIVE mode** — careful with test transactions; use Stripe test clock or refund yourself)
- ✅ `STRIPE_WEBHOOK_SECRET`
- ✅ `N8N_CALLBACK_SECRET`
- ✅ `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- ✅ `CLOUDCONVERT_API_KEY`
- ✅ `/api/health` and `/login` return 200 in production

Still missing (what actually needs work tonight):

- ❌ `STRIPE_PRICE_STARTER_ID` / `PRO_ID` / `SCALE_ID` — **section 2a**
- ❌ `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` / `UPLOAD_PRESET` — **section 3d**
- ❌ `RESEND_API_KEY` — **section 4**

**Also noticed — a URL inconsistency to resolve:**
- Your `.env.local` has `NEXT_PUBLIC_APP_URL=https://clear-path-v2.vercel.app`
- Your Obsidian active-context says production URL is `https://sensei-app.vercel.app`
- Pick one as canonical. Check `vercel domains ls` or the Vercel dashboard to see which is the real prod domain. Update the other reference. All `success_url`/`cancel_url`/webhook URL values must match the canonical one.

**Run preflight any time:** `node scripts/preflight.mjs`. Run `vercel env pull .env.prod.local` first to mirror production env locally, then re-run preflight to see the true prod state (not just local dev state).

---

## 0. Preflight (5 min)

Run this first to see what's already configured:

```bash
cd C:/Dev/ClearPath/COACH-OS
node scripts/preflight.mjs
```

It checks Vercel env vars and external reachability. Anything it flags red = blocker for that section below.

---

## 1. Apply pending migrations (5 min)

Two new migrations since last deploy — one from earlier (your Monday-deadline work) and one just added:

- `20260416200000_workspaces_import_folder_unique.sql` — **NEW tonight**. Prevents two coaches from registering the same Drive folder ID (would break imports silently without this).

Run against production Supabase:

```bash
# From project root
supabase db push --linked
# or: supabase migration up --linked
```

Verify in Supabase Dashboard → Database → Indexes:
- `uniq_workspaces_google_drive_import_folder_id` should exist.

---

## 2. Stripe setup (45 min)

### 2a. Platform subscription products (for coaches paying you)
**Stripe Dashboard → Products → Add product.** Create three:

| Plan | Price | Recurring | Save Price ID to env as |
|---|---|---|---|
| Starter | $49/mo | Monthly | `STRIPE_PRICE_STARTER_ID` |
| Pro | $99/mo | Monthly | `STRIPE_PRICE_PRO_ID` |
| Scale | $149/mo | Monthly | `STRIPE_PRICE_SCALE_ID` |

If you already have the IDs from `active-context.md` (`price_1THoZdQKTuROR5cInEEzGHXW` etc.), use those — just confirm they're in live mode, not test mode.

### 2b. Secret key
Stripe Dashboard → Developers → API keys → reveal live **secret** key. Save as `STRIPE_SECRET_KEY`.

### 2c. Webhook endpoint
Stripe Dashboard → Developers → Webhooks → Add endpoint:
- **URL:** `https://sensei-app.vercel.app/api/webhooks/stripe`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Click "Add endpoint" → reveal **Signing secret** → save as `STRIPE_WEBHOOK_SECRET`.

### 2d. Stripe Connect (for coach→client payments)
Stripe Dashboard → Connect → **Get started** → Platform profile:
- Country: US
- Platform name: whatever your brand will be (can edit later)
- Type: **Express** accounts
- Enable capabilities: **Card payments**, **Transfers**

No `STRIPE_CONNECT_CLIENT_ID` needed for Express — we use Account Links, not OAuth.
Optionally set `STRIPE_CONNECT_DEFAULT_COUNTRY=US`.

---

## 3. Google Drive + CloudConvert + Cloudinary (45 min)

### 3a. Google Cloud project
1. https://console.cloud.google.com → New Project (name: `coach-os-prod` or similar).
2. APIs & Services → Library → enable **Google Drive API**.
3. APIs & Services → OAuth consent screen → External. Fill in app name, support email, developer email. Add scope `https://www.googleapis.com/auth/drive.readonly`. Add your own email as test user.
4. APIs & Services → Credentials → Create credentials → **OAuth client ID** → Web application.
   - Authorized redirect URIs: `https://sensei-app.vercel.app/api/integrations/google-drive/callback` AND `https://developers.google.com/oauthplayground`.
   - Save Client ID → `GOOGLE_CLIENT_ID`, Client Secret → `GOOGLE_CLIENT_SECRET`.

### 3b. Generate refresh token (one-time, for n8n)
1. https://developers.google.com/oauthplayground
2. Gear icon (top right) → check "Use your own OAuth credentials" → paste Client ID + Secret.
3. Left panel, Step 1: scroll to "Drive API v3" → select `https://www.googleapis.com/auth/drive.readonly`.
4. Authorize APIs → sign in with the Google account whose Drive you'll read from.
5. Exchange authorization code for tokens → copy **Refresh token**.
6. Save as `GOOGLE_DRIVE_REFRESH_TOKEN` (n8n only — NOT Vercel).

### 3c. CloudConvert
1. https://cloudconvert.com → sign up.
2. Dashboard → API v2 → Keys → Create key. Save as `CLOUDCONVERT_API_KEY`.
3. (Optional, recommended later) Dashboard → Webhooks → add webhook `https://sensei-app.vercel.app/api/webhooks/cloudconvert` → copy signing secret → `CLOUDCONVERT_WEBHOOK_SECRET`.

### 3d. Cloudinary
1. https://cloudinary.com → sign up → dashboard shows Cloud Name, API Key, API Secret. Save all three.
2. Settings → Upload → Upload presets → Add upload preset. Signing mode: **Unsigned**. Copy the preset name (e.g., `coach_os_videos`). Save as `CLOUDINARY_UPLOAD_PRESET`.

### 3e. Generate N8N_CALLBACK_SECRET
Any long random string. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Save the output — it must be identical in both Vercel (`N8N_CALLBACK_SECRET`) and n8n (`N8N_CALLBACK_SECRET` variable).

---

## 4. Resend (10 min)

1. https://resend.com → sign up.
2. API Keys → Create → save as `RESEND_API_KEY`.
3. Domains → Add domain (use your final brand domain once chosen — can set up now with whatever, fix later).
4. Add DNS records in your registrar (will do Saturday when domain is registered).
5. For tonight, you can send from Resend's sandbox `onboarding@resend.dev` — works for testing immediately, won't work for production emails until domain is verified.

---

## 5. Add all env vars to Vercel (15 min)

Vercel Dashboard → your project (sensei-app) → Settings → Environment Variables. Add each for **Production** (and Preview if you deploy to previews):

```
# App
NEXT_PUBLIC_APP_URL=https://sensei-app.vercel.app

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_ID=price_...
STRIPE_PRICE_PRO_ID=price_...
STRIPE_PRICE_SCALE_ID=price_...
STRIPE_CONNECT_DEFAULT_COUNTRY=US

# Video pipeline
N8N_CALLBACK_SECRET=<from step 3e>
GOOGLE_CLIENT_ID=<from step 3a>
GOOGLE_CLIENT_SECRET=<from step 3a>
GOOGLE_DRIVE_REDIRECT_URI=https://sensei-app.vercel.app/api/integrations/google-drive/callback
CLOUDCONVERT_API_KEY=<from step 3c>
CLOUDCONVERT_WEBHOOK_SECRET=<optional, from step 3c>
CLOUDINARY_CLOUD_NAME=<from step 3d>
CLOUDINARY_API_KEY=<from step 3d>
CLOUDINARY_API_SECRET=<from step 3d>
CLOUDINARY_UPLOAD_PRESET=<from step 3d>

# Email
RESEND_API_KEY=<from step 4>

# Optional — only if Vercel Deployment Protection is ON:
VERCEL_AUTOMATION_BYPASS_SECRET=<from Vercel Protection Bypass for Automation>
```

After saving: **Vercel → Deployments → redeploy the latest production deployment** so new env vars take effect.

---

## 6. n8n setup (20 min)

Open your n8n instance → Settings → Variables. Add:

```
GOOGLE_CLIENT_ID              = (same as Vercel)
GOOGLE_CLIENT_SECRET          = (same as Vercel)
GOOGLE_DRIVE_REFRESH_TOKEN    = (from step 3b — n8n ONLY)
CLOUDCONVERT_API_KEY          = (same as Vercel)
CLOUDINARY_CLOUD_NAME         = (same as Vercel)
CLOUDINARY_UPLOAD_PRESET      = (same as Vercel)
CLEARPATH_APP_URL             = https://sensei-app.vercel.app
N8N_CALLBACK_SECRET           = (same as Vercel)
```

Then import the workflow:
- The Code node script lives at `n8n-workflows/scripts/drive-url-pipeline-code.js`.
- You need a workflow with: **Google Drive trigger** → **Code node** (paste that script) → done.
- Google Drive trigger config: watch "New file in folder" — but for multi-tenant, watch a **parent folder** that contains each coach's subfolder, OR configure to watch multiple folders. For the first coach, just point at Combative Alchemy's folder directly. Refactor to parent-folder-watch when you have coach #2.
- Set the Google credential in the trigger using Client ID + Secret + Refresh Token from step 3.
- Activate the workflow.

---

## 7. End-to-end test — Stripe subscription (15 min)

1. Open https://sensei-app.vercel.app/signup in an incognito window.
2. Sign up with a throwaway email. Verify via confirmation link.
3. Go through trial → pick Pro ($99).
4. Use live card (you can refund yourself after): real card or ideally Stripe's test mode first if you have a test env.
5. Confirm:
   - Redirect back to `/coach/subscription?success=true`
   - In Supabase → `subscriptions` table: row exists with `status='active'` or `'trialing'`
   - Stripe Dashboard → Events: `checkout.session.completed` received and processed (check for green checkmark in webhook attempts)

If webhook shows red in Stripe:
- Click the failed event → see response. Usually a missing env var.
- Most common: `STRIPE_WEBHOOK_SECRET` mismatch.

---

## 8. End-to-end test — Stripe Connect (15 min)

Still in the test coach account:
1. Coach dashboard → Settings → Payments tab.
2. Click **Connect Stripe** → redirects to Stripe onboarding.
3. Use Stripe's test business data:
   - Company: dummy name
   - Address: any US address
   - DOB: any adult date
   - SSN last 4: `0000` (Stripe test mode accepts this)
   - Bank: routing `110000000`, account `000123456789`
4. Submit → should redirect back to `/coach/settings?tab=payments&stripe_return=ready`.
5. Verify in Supabase: `workspaces.stripe_connect_account_id` populated, `stripe_connected=true`.

Now test the invoice flow:
1. Create a test client (add via coach dashboard).
2. Create a session package: "Test Pack" / $10.
3. Invoice that test client for that package.
4. Log in as the client (use the invite flow or create a second throwaway).
5. Client portal → Invoices → click pending invoice → Pay → Stripe Checkout with test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
6. Verify:
   - Redirect to `/client/invoices?paid=1`
   - Supabase: `session_invoices.status='paid'`, `paid_at` set
   - Supabase: `payments` table has a matching row
   - Stripe Dashboard → Payments: charge shows up, $10 pending transfer to connected account

---

## 9. End-to-end test — Drive video import (20 min)

1. Log in as the same test coach.
2. Settings → Integrations (or Videos → Settings — depends on UI) → paste a Drive folder ID.
   - Create a Drive folder first, share as **"Anyone with link can view"**, grab folder ID from URL.
3. In Drive, upload a 1-min test video into that folder.
4. In n8n → Executions → watch for the workflow to fire (may take up to the trigger's polling interval, usually 1-5 min).
5. Once n8n finishes:
   - In COACH-OS → Videos library → new video should appear with status "ready"
   - `videos` table in Supabase should have: `drive_file_id`, `playback_url` (Cloudinary URL), `processing_status='ready'`
6. Click the video in COACH-OS → should play inline.

### If it doesn't work — failure triage

| Symptom | Likely cause | Fix |
|---|---|---|
| n8n workflow never fires | Google Drive credential expired or folder not shared | Re-auth in n8n; verify folder is "Anyone with link" |
| n8n Code node errors "Google token" | Refresh token invalid | Re-run step 3b to generate a new one |
| n8n Code node errors "Folder not registered" | `folderId` doesn't match any workspace's `google_drive_import_folder_id` | Check Supabase — did you save it? Whitespace? |
| CloudConvert job fails | API key wrong or quota exceeded | Check CloudConvert dashboard |
| Cloudinary upload fails | Upload preset doesn't exist or not unsigned | Recreate preset as unsigned |
| Video shows up with `processing_status='failed'` | CloudConvert couldn't download from Drive | Folder not shared publicly — must be "Anyone with link" |

---

## 10. Branding sweep — **AFTER name is locked Friday 6pm** (10 min)

Batch find-and-replace "Powered by ClearPath" → "Powered by [YourBrand]" across **11 files**:

```
app/(auth)/signup/SignupPageClient.tsx         (2 occurrences)
app/(auth)/login/DualRoleLoginPage.tsx         (2 occurrences)
app/(auth)/forgot-password/page.tsx            (1)
app/coach/settings/SettingsPageContent.tsx     (1)
app/coach/dashboard/CoachDashboardContent.tsx  (1)
components/layout/Sidebar.tsx                  (2)
components/layout/ClientPortalSidebar.tsx      (1 — in a comment, can update too)
```

Also scan for `ClearPath Solutions` and `clearpath.com` for any remaining brand strings. I removed one stale `https://app.clearpath.com` fallback in `app/api/billing/checkout/route.ts` already.

Commit, redeploy. Demo-ready.

---

## 11. Smoke test the production site (10 min)

After rebrand + redeploy:
- Home page loads ✓
- Signup works ✓
- Coach dashboard loads ✓
- Client portal loads ✓
- /api/health returns 200 ✓
- UptimeRobot configured on /api/health (optional but smart before demo)

---

## Demo day contingencies

If at Monday AM something is still broken:
- **Stripe Connect not ready:** Demo manual payment method (Zelle/cash option in invoice flow). Tell coach "Stripe integration goes live this week."
- **Drive import not firing:** Manually upload the demo video via the coach videos UI directly. Don't explain the pipeline — just show the "videos in your library" experience.
- **Emails not sending:** Use the invite flow anyway; you can paste the signup link directly into a message if Resend is misbehaving.

**The demo never fails on missing automation if the visible UX is solid.** Ship what works, patch what doesn't, keep the conversation going.
