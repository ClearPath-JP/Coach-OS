# COACH-OS — Production Readiness Audit

**Date:** 2026-04-15
**Auditor:** Claude Opus 4.6 (Security + Product Review)
**Verdict:** See Step 7

---

## STEP 1 — SECURITY AUDIT

### Auth & Access: MOSTLY SOLID

**What's good:**
- `requireCoach()` and `requireClient()` helpers enforce role + workspace on every protected route
- `assertAdminApi()` enforces admin email + rate limiting consistently
- Rate limiting on auth endpoints: signup (3/hr), login (5/15min), password change (5/hr)
- `prevent_admin_self_grant()` database trigger blocks privilege escalation
- Admin email is env-var controlled, not self-grantable

**Issues found:**

| Issue | Severity | Detail |
|---|---|---|
| Admin bypass on coach login | Medium | Admin with client role can force login as coach via `isPlatformAdmin` bypass in login route. Intentional for support, but undocumented. |
| Signup auto-confirms email | Medium | When `SUPABASE_SERVICE_ROLE_KEY` is set (always in prod), signup uses `email_confirm: true` — user never verifies their email. Attackers can sign up with any email. |
| Role set in user metadata | Medium | `user_metadata: { role: 'client' }` during signup. If auth metadata is writable client-side, role could be spoofed. Mitigated by `profiles.role` being the actual check. |
| No CSRF tokens | Medium | No CSRF protection on state-changing endpoints. Mitigated by SameSite cookies (Supabase default) but not explicitly verified. |
| No 2FA | Low | Coaches handle financial data. No option for two-factor auth. Acceptable for launch. |

### Database (Supabase): STRONG

**What's good:**
- All 46 tables have RLS enabled
- All RPC functions use parameterized queries — zero SQL injection risk
- `stripe_webhook_events` table blocks all authenticated access (service role only)
- Audit logging on admin operations
- Referential integrity with ON DELETE CASCADE/SET NULL

**Issues found:**

| Issue | Severity | Detail |
|---|---|---|
| `current_workspace_id()` trusts app context | Medium | Function reads `app.workspace_id` from session config. If application code sets the wrong value, RLS breaks. No validation that the value belongs to the authenticated user. |
| Client identified by email in RLS | Medium | Multiple tables (daily_checkins, client_goals, testimonials) use email matching for client access. If same email exists in two workspaces, wrong workspace could be matched via `LIMIT 1`. |
| Service role used without workspace filter | Low | `app/api/coach/re-engagement/route.ts` uses service client for session counts without explicit workspace_id filter. Low risk (client_id is workspace-scoped) but violates defense-in-depth. |

### API Routes: EXCELLENT

**What's good:**
- 86 routes implement `checkRateLimitAsync()`
- 640+ lines of Zod validation schemas covering every POST/PATCH endpoint
- No direct SQL — all queries use Supabase client (parameterized)
- Search inputs escaped with `escapeIlike()` and `sanitizeIlikeSearch()`
- Timing-safe comparison for webhook secrets

**Security headers (next.config.ts):**
- Strict-Transport-Security (HSTS)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Content-Security-Policy (restrictive, no unsafe-eval in prod)
- Permissions-Policy: camera/microphone/geolocation disabled

**Issues found:**

| Issue | Severity | Detail |
|---|---|---|
| Admin error messages leak internals | Low | `inviteError.message` returned directly in admin invite route. Could expose Supabase error details. |
| Video token endpoint missing rate limit | Low | `POST /api/videos/[id]/token` generates stream tokens without rate limiting. |
| Temp password in API response | Low | `POST /api/clients` returns `tempPassword` in JSON. Intentional for onboarding but should be documented. |

### Payments (Stripe): HAS A CRITICAL GAP

**What's good:**
- Webhook signature verification implemented correctly
- Event ID deduplication prevents replay attacks
- User ownership verified in activate route (`authUser.id !== userId`)
- Returns 200 always to prevent Stripe retry loops

**Issues found:**

| Issue | Severity | Detail |
|---|---|---|
| **No subscription = full access** | **CRITICAL** | `coach/layout.tsx` allows full dashboard access if no subscription record exists. Comment says "free trial / pre-Stripe coach — allow access." This means ANY coach account without a Stripe subscription gets unlimited access forever. |
| Only checks `past_due` and `cancelled` | High | Subscription status check ignores `unpaid`, `paused`, `incomplete`. A coach with `unpaid` status still has full access. |
| No plan limit enforcement | High | Starter plan allows 15 clients (per `PLAN_LIMITS`), but no API route actually enforces this. A Starter coach can create 100 clients. |
| No rate limit on checkout creation | Medium | `POST /api/billing/new-coach-checkout` has no rate limiting. Could be abused to create many Stripe sessions. |

### File Handling: SOLID

**What's good:**
- Video uploads validated: max 100MB, magic byte verification, MIME type check
- Stream proxy hides raw Google Drive URLs from clients
- Signed stream tokens (HMAC-SHA256) for Range request auth
- Storage limits checked against plan before upload
- Access control: 3-path verification (direct assignment, program enrollment, own submission)

**Issues found:**

| Issue | Severity | Detail |
|---|---|---|
| Stream token shareable | Low | Token valid for 1 hour. If intercepted, video can be streamed by anyone. Acceptable for MVP — video content is training material, not sensitive. |

---

## STEP 2 — PRODUCT LOGIC AUDIT

### Can users break the system?

| Scenario | Risk | Status |
|---|---|---|
| Coach creates client with duplicate email | Low | Upsert pattern handles this. No crash. |
| Client accesses another coach's data | Low | RLS + workspace_id filtering prevents cross-tenant access. |
| Two coaches invite same client email | Medium | Client resolves to first workspace via `LIMIT 1`. Could land in wrong workspace. |
| Coach deletes client mid-session | Low | ON DELETE CASCADE cleans up related records. No orphan data. |
| Stripe webhook fails silently | Medium | Returns 200 OK on error (prevents retry). Subscription state could become stale. Logged for investigation. |
| Video import while over storage limit | Low | `checkStorageLimit()` runs before import. Properly rejected. |
| Race condition on double-click "Invite Coach" | Low | Supabase upsert handles this. No duplicate workspace. |

### Reliable flows:

| Flow | Status | Notes |
|---|---|---|
| Coach signup → workspace creation | Works | But email not verified (see auth issue) |
| Coach invites client → client gets portal | Works | Temp password generated, client created |
| Session scheduling | Works | Availability slots, conflict checking in place |
| Video upload (Drive → library) | Works | Manual import works. Auto-import needs n8n config. |
| Video assignment → client views | Works | 3-path access control verified |
| Stripe checkout → subscription active | Works | But free trial bypass undermines this |
| Payment tracking | Works | Payments recorded, visible in coach dashboard |

### Data consistency risks:

| Risk | Severity | Detail |
|---|---|---|
| Subscription record out of sync with Stripe | Medium | If webhook fails silently, local subscription status diverges from Stripe. Coach could lose access (or keep access) incorrectly. |
| workspace_id not set on all tables consistently | Low | Most tables have workspace_id. Some operations rely on coach_id → workspace join. If coach changes workspace, references break. |

---

## STEP 3 — PERFORMANCE & SCALE

### At 10 coaches (50 clients): NO ISSUES

Everything works. Supabase handles this without breaking a sweat. API response times will be fast. No concern.

### At 100 coaches (500 clients):

| Area | Risk | Detail |
|---|---|---|
| Admin dashboard | Medium | `fetchAdminOverviewPayload()` runs 24 parallel queries on every page load. At 100 coaches, this is 24 queries hitting large tables. Will slow down. |
| Video streaming proxy | Low | Each video view proxies through your Vercel function. At 100 concurrent streams, you'll hit function concurrency limits. |
| Database connections | Low | Supabase Pro handles 500+ connections. Not a concern yet. |

### At 1,000 coaches (5,000 clients):

| Area | Risk | Detail |
|---|---|---|
| Admin overview | High | 24 parallel queries will timeout. Needs caching or pre-aggregation. |
| RLS performance | Medium | `current_workspace_id()` function runs on every query. At 5,000 clients, the subquery to resolve workspace via email will slow down. Needs index tuning. |
| Video proxy | High | Vercel functions have concurrency limits. 1,000 coaches streaming videos = potential function exhaustion. Need CDN or direct Drive links with signed URLs. |
| Supabase row counts | Low | 5,000 clients, ~50,000 sessions, ~10,000 payments — still within Supabase Pro limits. |
| Single-region | Medium | All data in one Supabase region. Coaches in different time zones will see varying latency. |

**Bottom line:** The architecture holds to ~100 coaches without changes. Beyond that, you need: admin query caching, video CDN, and index optimization. But you're at 0 — these are future problems.

---

## STEP 4 — UX / TRUST AUDIT

### From a paying coach's perspective:

| What they see | Trust impact | Verdict |
|---|---|---|
| Clean, dark UI with branded nav | Positive | Feels custom, not generic |
| Their brand name in the top bar | Positive | White-label feel |
| Client portal with their logo | Very positive | "My clients see MY brand" — this sells |
| Video library with Drive import | Positive | Practical, solves a real problem |
| Stripe billing integrated | Positive | Professional, they trust Stripe |
| "Powered by ClearPath" footer | Neutral | Standard SaaS branding. Acceptable. |
| Error pages / loading states | Needs check | Skeleton loaders exist. Error boundaries exist. Acceptable. |
| Mobile experience | Needs check | Bottom dock nav exists. Core flows should work. Test needed. |

### What might make a coach NOT pay:

| Concern | Risk | Fix |
|---|---|---|
| "Can my clients actually log in and see their stuff?" | High | Must demo this live. The client portal is the #1 selling point. |
| "What if I stop paying? Do I lose my data?" | Medium | No data export feature for coaches. Add CSV export or at minimum document data retention. |
| "Is my client data safe?" | Medium | No visible security indicators (no "your data is encrypted" messaging). Add a simple security page. |
| "Can I try it before paying?" | High | Free trial exists but has no time limit. Good for onboarding, bad for revenue. Need trial expiration. |
| No onboarding guidance in-product | Medium | Coach lands on Schedule page. No "getting started" checklist or walkthrough. Confusion for first-time users. |

---

## STEP 5 — PRODUCTION READINESS SCORES

| Category | Score | Reasoning |
|---|---|---|
| **Security** | **7/10** | Strong foundations (RLS, rate limiting, validation, headers). Deducted for: free trial bypass (critical), email not verified on signup, no plan enforcement, client email resolution ambiguity. |
| **Stability** | **8/10** | Solid code. Good error handling. Webhook idempotency. Deducted for: silent webhook failure risk, subscription state sync gap. |
| **UX** | **6/10** | Functional but raw. No onboarding flow in-product. No "getting started" guide. Mobile not fully verified. Deducted for: missing guided first-use experience, no data export for coaches. |
| **Scalability** | **7/10** | Fine for 0-100 coaches. Admin dashboard and video proxy will bottleneck beyond that. Deducted for: 24-query admin page, video proxy through Vercel functions. |
| **Overall** | **7/10** | Ready for first customer with targeted fixes. Not ready for 100. |

---

## STEP 6 — CRITICAL ISSUES (PRIORITY)

### 🔴 Must Fix Before ANY User

**1. Free trial bypass must have a time limit**
- **Where:** `app/coach/layout.tsx:61-70`
- **Problem:** No subscription record = unlimited free access forever. Any coach invited by admin gets full access with no payment path.
- **Fix:** Add trial expiration. Check `workspaces.created_at` — if workspace is older than 14 days and no subscription exists, redirect to billing. This is ~10 lines of code.

**2. Subscription status must check all non-active states**
- **Where:** `app/coach/layout.tsx:65-68`
- **Problem:** Only blocks `past_due` and `cancelled`. Misses: `unpaid`, `paused`, `incomplete`, `incomplete_expired`.
- **Fix:** Change to allowlist — only permit `active` and `trialing`. Block everything else.

**3. Email verification on signup**
- **Where:** `app/api/auth/signup/route.ts:65-122`
- **Problem:** Signup auto-confirms email without verification. Anyone can register with any email.
- **Fix:** Remove `email_confirm: true` from admin user creation. Let Supabase send the confirmation email. Requires Resend API key (already on your setup checklist).

**4. Update Stripe webhook URL**
- **Where:** Stripe Dashboard → Developers → Webhooks
- **Problem:** Old URL `coach-os-chi.vercel.app` won't work after rename to `sensei-app`.
- **Fix:** Update endpoint URL in Stripe to `https://sensei-app.vercel.app/api/webhooks/stripe`.

### 🟠 Should Fix Soon (Within First Week of Use)

**5. Enforce plan limits server-side**
- **Where:** Client creation route, video upload route
- **Problem:** No enforcement of max clients or storage by plan. Starter coach can create unlimited clients.
- **Fix:** Check `PLAN_LIMITS.maxClients` before creating client. Check `PLAN_LIMITS.maxVideoStorageGb` before video import (already done for video — need it for clients).

**6. Add workspace_id filter to client email lookups**
- **Where:** `lib/video-stream-access.ts:136-138`, `app/api/error-report/route.ts:71`
- **Problem:** Client lookup by email without workspace filter. Wrong workspace matched if same email exists in two workspaces.
- **Fix:** Add `.eq('workspace_id', workspaceId)` to these queries.

**7. Sanitize admin error messages**
- **Where:** `app/api/admin/coaches/invite/route.ts:32,74`
- **Problem:** Raw Supabase error messages returned to client. Could leak table names or constraint details.
- **Fix:** Log full error server-side, return generic "Could not complete operation" to client.

**8. Rate limit video token endpoint**
- **Where:** `app/api/videos/[id]/token/route.ts`
- **Problem:** No rate limiting on token generation. Could be abused.
- **Fix:** Add `checkRateLimitAsync({ key: userId, windowMs: 60000, max: 60 })`.

### 🟢 Nice to Improve (Post-Launch)

**9. Add CSRF token validation** — Defense-in-depth. SameSite cookies mitigate this for now.

**10. Add coach data export** — CSV download of clients, sessions, payments. Builds trust ("I can leave if I want").

**11. Add in-product onboarding checklist** — "Add your first client", "Schedule a session", "Upload a video". Reduces confusion.

**12. Document the admin login bypass** — The `isPlatformAdmin` bypass in login is useful for support but should be explicitly documented and audit-logged.

**13. Add 2FA option** — Coaches handle financial and client health data. 2FA should be available by the time you have 20+ coaches.

**14. Validate `app.workspace_id` in `current_workspace_id()` function** — Add a check that the workspace belongs to the authenticated user before trusting the app context.

---

## STEP 7 — FINAL VERDICT

### Is this safe to onboard your first paying customer?

## YES — with 4 fixes first.

The application has strong security foundations: comprehensive RLS, rate limiting on 86 routes, Zod validation on all inputs, proper security headers, webhook signature verification, and workspace isolation. This is well above average for a solo-built SaaS.

**The 4 blockers are all small fixes:**

1. Add trial expiration (~10 lines in coach layout)
2. Allowlist subscription statuses (~5 lines in coach layout)
3. Remove email auto-confirm (~1 line in signup route)
4. Update Stripe webhook URL (Stripe dashboard, 2 minutes)

**After these 4 fixes, you can safely onboard Combative Alchemy.**

The remaining issues (plan limits, email lookups, error messages) are real but won't affect a single coach with a handful of clients. Fix them in the first week of use.

The product works. The security is solid. The architecture holds. Stop auditing and start selling.
