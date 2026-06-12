# Your tasks — ready Claude Chrome prompts (2026-06-11)

These are the launch items **only you can do** (dashboards, real payment checks, visual review). Each block below is written to **paste straight into Claude in Chrome**. Do them in order. Prompts 3–6 assume the new fixes are **deployed** (see "Deploy first" below).

> **Deploy first (gets the audit fixes live):** from `C:\Dev\ClearPath\COACH-OS`, review `git diff`, then commit the branch and `vercel --prod`. Current prod is the Arcade branch but **without** today's SEO/legal/contrast fixes until you redeploy. Demo logins: coach `coach@example.com` / `Demo123!`, client `client@example.com` / `ClientDemo123!`.

---

## 🔴 Prompt 1 — Verify the founding Stripe price is really $99/mo (LIVE)
*This is the literal thing that charges your first coach. The code trusts the env ID blindly.*

```
Go to dashboard.stripe.com and make sure I'm in LIVE mode (not Test — toggle is top-right).
Open Product catalog → find the product behind the "Founding" coach plan. Confirm there is an
ACTIVE recurring Price of exactly $99.00 USD / month. Tell me: the Price ID (price_...), the
exact amount, the interval (should be "monthly"), whether it's Live or Test, and whether it's
Active. Then check Developers → Webhooks: confirm a LIVE endpoint to coach.foundos.ai/api/webhooks/stripe
exists and is enabled for checkout.session.completed, invoice.paid, invoice.payment_failed,
customer.subscription.updated and .deleted. Report anything missing — do not change anything.
```

## 🔴 Prompt 2 — Supabase: leaked-password protection + email confirm + one permission
```
Go to supabase.com/dashboard and open the Coach-OS project (ref owiqourfyjxwveopijrg).
1) Authentication → Policies/Providers → Password security: turn ON "Leaked password protection"
   (HaveIBeenPwned). If it's greyed out, it needs the Pro plan — tell me.
2) Authentication → Providers → Email: tell me whether "Confirm email" is ON or OFF (I need to know;
   don't change it yet).
3) Project Settings → confirm the plan (Free/Nano vs Pro).
Report what you found and changed. Don't touch anything else.
```
*(Optional DB hardening I flagged: `REVOKE EXECUTE ON FUNCTION public.recalc_workspace_storage(uuid) FROM authenticated;` in the SQL editor — low priority, your call.)*

## 🔴 Prompt 3 — Gold-standard checkout smoke (do AFTER deploy)
*Proves the $99 path resolves end-to-end on the live build.*
```
Open https://coach.foundos.ai in a fresh incognito window. Click "Get started"/"Claim a spot",
create a brand-new coach account with a throwaway email, and proceed to the subscribe page.
Confirm the page says "$99/month", the auto-renewal line and the Terms/Privacy/Refunds links are
visible. PAYWALL CHECK: before paying, manually type coach.foundos.ai/coach/dashboard and
coach.foundos.ai/onboarding in the URL bar — confirm BOTH bounce you back to /subscribe (you must
not be able to reach a free dashboard without paying). Then click the pay button. On the Stripe
Checkout page, confirm it shows $99.00 per month and the product name — then STOP (don't enter a
card unless you want a real $99 charge you'll refund). Screenshot each step and tell me if anything
looked broken, mispriced, or let you in free.
```

## 🟡 Prompt 4 — Eyeball the live Arcade app, authed (do AFTER deploy)
```
Go to https://coach.foundos.ai/login and sign in as coach@example.com / Demo123!. Walk through
Dashboard, Clients, Schedule, Classes, Memberships, Videos, Settings. I'm checking the Dojo Arcade
reskin on real data: flag any unreadable text (especially light text on the teal/coral/blue/yellow
belt tiles), broken layouts, overlapping elements, or anything that says "undefined"/"NaN"/raw dates.
Then sign out, sign in as the client client@example.com / ClientDemo123! and do the same on the
student portal. Give me a short bulleted list of anything that looks off, with a screenshot each.
```

## 🟡 Prompt 5 — Verify a student submission upload + playback (do AFTER deploy)
*Confirms the private-bucket + signed-URL video fix works end-to-end.*
```
Signed in as the client (client@example.com / ClientDemo123!), find an assignment that accepts a
video submission and upload a short test video. Then sign in as coach@example.com / Demo123!, open
that client/assignment, and confirm the submitted video PLAYS (not a broken/gray player). Tell me
whether playback worked and screenshot it.
```

## 🟢 Prompt 6 — SEO go-live: sitemap + share-card (do AFTER deploy)
```
1) Confirm these load: https://coach.foundos.ai/robots.txt , /sitemap.xml , /og.png (should show a
   cream Korva card). 
2) Go to Google Search Console (search.google.com/search-console), add/verify the coach.foundos.ai
   property if needed, and submit the sitemap https://coach.foundos.ai/sitemap.xml.
3) Open the Facebook Sharing Debugger (developers.facebook.com/tools/debug), paste
   https://coach.foundos.ai , click "Scrape Again", and confirm the preview shows the Korva OG image
   + title + description. Do the same on the X/Twitter card validator if available.
Report the results and any warnings.
```

---

## 🌐 Prompt 7 — wire up korvacoach.com (do after buying it in Cloudflare)
*Points the app at the new domain. The code already references korvacoach.com.*
```
I bought korvacoach.com via Cloudflare and need my Next.js app pointed at it. The app is on
Vercel, project "sensei-app", currently live at coach.foundos.ai.
1) vercel.com → project sensei-app → Settings → Domains. Add korvacoach.com AND www.korvacoach.com.
   Make korvacoach.com the Primary domain; if offered, set coach.foundos.ai to Redirect to it.
   Tell me the exact DNS records Vercel asks me to add (A record IP and/or CNAME target).
2) dash.cloudflare.com → korvacoach.com → DNS → Records. Add the records Vercel gave me (e.g.
   A @ → the Vercel IP, CNAME www → cname.vercel-dns.com). Set each to "DNS only" (grey cloud,
   NOT proxied/orange) so Vercel can issue SSL. Confirm what you added.
3) Vercel → Settings → Environment Variables → set NEXT_PUBLIC_APP_URL = https://korvacoach.com for
   Production (single value, no comma).
4) supabase.com → Coach-OS project → Authentication → URL Configuration. Set Site URL to
   https://korvacoach.com and add it to the Redirect URLs allowlist (keep coach.foundos.ai too).
Report what you changed + the DNS records, and whether Vercel shows "Valid Configuration" / SSL
issued (can take a few minutes).
```

### Not a browser task
- ~~Close the free side-door~~ ✅ **Done — paywall-first is implemented + build-verified** (the free `/onboarding` mint now refuses; unpaid coaches are sent to `/subscribe`; your demo + paid coaches still work). Prompt 3 above doubles as the live confirmation once deployed.
- **Business entity + governing-law state** for the Terms page (I used neutral wording you can make specific once FoundOS is formally set up — e.g. "Georgia, USA").
