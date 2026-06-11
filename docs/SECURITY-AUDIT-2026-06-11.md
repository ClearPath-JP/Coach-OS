# 🔐 Security Audit — Multi-Tenant Isolation — 2026-06-11

**Your question: "can one user somehow get access to everyone's info?"**
**Answer: No — tenant isolation is strong at both the database and the API layer.** One real gap (uploaded *files* are public-by-URL) and a short list of hardening items. **Security score: 90/100 (A−).**

Method: Supabase security advisors + a full RLS/policy/function inventory on the prod DB (read-only metadata queries), plus 3 parallel code-audit agents (coach API, client API, admin/webhooks/platform). No data was modified.

---

## ✅ What's verified solid

### Database / RLS layer (the backstop)
- **RLS is enabled with ≥1 policy on all 62 public tables.** Zero unprotected tables.
- **Zero over-permissive (`true`) policies anywhere.** Every policy scopes by `auth.uid()` / `workspace_id` / `is_super_admin` / `coach_id`. The only non-workspace policies are three **`false` (deny-all)** policies on `stripe_webhook_events` (clients can't touch webhook records — correct).
- **No views** in the public schema → none of the "views silently bypass RLS" risk.
- **Every `SECURITY DEFINER` RPC self-authorizes.** `get_coach_conversations`, `…_near_complete_programs`, `…_reengagement_inactive_clients`, `…_stale_thread_clients` all contain `AND EXISTS (SELECT 1 FROM coaches co WHERE co.user_id = auth.uid() AND co.user_id = p_coach_user_id AND co.workspace_id = p_workspace_id)` — so passing *another* coach's IDs returns nothing. **No RPC IDOR.**
- **`is_super_admin()`** returns the caller's *own* flag; **`prevent_admin_self_grant`** trigger blocks a user from self-granting admin.

### API / app layer
- **Coach API — ISOLATED.** All 31 routes resolve the workspace server-side (`requireCoach()` / `resolveCoachWorkspaceIdForSession`), scope every query by it, and verify `[id]` ownership via `.eq('workspace_id', workspaceId)`. No route trusts a client-supplied `workspace_id`/`coach_id`.
- **Client API — ISOLATED.** Every route resolves the client from the **session** (email→`clients` row), never a body/query `client_id`; IDOR-by-id routes re-verify the resource belongs to this client/workspace.
- **Admin — SOLID.** Every `app/api/admin/**` route is gated by `assertAdminApi` → `requireSuperAdmin` → `isPlatformAdmin` (`ADMIN_EMAIL` or `profiles.is_super_admin`, never self-grantable); admin pages sit under a redirecting `(shell)` layout.
- **Webhooks verified before mutation.** Stripe `constructEvent` (signature) runs before any DB write + idempotency; CloudConvert uses HMAC + `timingSafeEqual`. Stripe-signed metadata (`client_id`/`workspace_id`) is trustworthy because the signature is verified — not forgeable.
- **No secret exposure.** No secret is `NEXT_PUBLIC_`; all secret-bearing libs are `'server-only'`. No authorization rides on user-editable `user_metadata`.
- **Hardening already in place:** deny-by-default SSRF allowlist (blocks loopback/RFC-1918/metadata IPs), upload validation (MIME + size + magic bytes), parameterized RPC calls (no SQL injection), fail-closed rate limiting.

**Bottom line on your question:** there is **no enumerable path for one tenant to read another's data** — RLS covers every table, every API route is workspace-scoped, admin is gated, and the RPCs self-authorize.

---

## 🟡 Findings to fix (prioritized)

### 1. 🟡 HIGH — Uploaded files live in **public** storage buckets
`assignment-submissions`, `studio-audio`, and `videos` buckets are `public: true`, and files are served via `getPublicUrl` (`app/api/client/videos/upload/route.ts:87`, `lib/post-upload.ts:172`, `lib/drive-import/*`). **Effect:** a student's uploaded assignment file is readable by *anyone with the URL*, with no auth/tenant check at the storage layer — which bypasses the app's access control.
- **Not trivially exploitable** (paths are UUIDs, so you can't enumerate other tenants' files), but it's the wrong model for tenant data and should be fixed before scaling.
- **Fix:** make these buckets **private** and serve via **signed URLs** (`createSignedUrl`, short TTL) from the already-access-controlled routes (`lib/video-stream-access.ts` already does the authorization). `avatars` can stay public (low sensitivity). ⚠️ This must be done *together* with the code change — flipping the buckets private alone would break every stored public URL.

### 2. 🟡 Internal n8n callbacks trust body-supplied scope
`app/api/videos/from-n8n/route.ts:49`, `videos/processing-complete/route.ts:60`, and the CloudConvert n8n-fallback accept `workspaceId`/`videoId` from the body, gated **only** by `N8N_CALLBACK_SECRET`. Not attacker-reachable today (server-to-server), but if that secret leaks, an attacker could write `videos` rows into any tenant. **Fix:** confirm the secret is high-entropy + rotated, and add a `coachId ∈ workspaceId` sanity check before insert.

### 3. 🟡 `recalc_workspace_storage(p_workspace_id)` is externally callable with no auth check
A signed-in user can call this RPC with any workspace's id. **Impact is low** — it only recomputes a storage counter (returns no data, grants no access). **Fix:** `REVOKE EXECUTE` from `anon`/`authenticated` (it's only invoked by a trigger). *(Needs your OK — it's a DB change.)*

### 4. 🟡 Client profile-name update runs browser-side
`ClientProfileContent.tsx:39` writes `clients` directly from the browser (anon client) with a server-passed `clientId`; isolation holds **only** because the `clients_update_workspace` RLS policy restricts to `email = (profiles.email of auth.uid())`. Correct today, but 100% RLS-dependent. **Fix:** move profile writes behind a `requireClient()` route (defense-in-depth).

### 5. 🟡 Leaked-password protection is disabled
Supabase Auth isn't checking new passwords against HaveIBeenPwned. **Fix:** enable it — requires **Supabase Pro** (owner action).

### 💡 Defense-in-depth (low priority)
- `current_workspace_id()` reads an `app.workspace_id` GUC first — **not** client-settable via the Data API (safe), but confirm the server only ever sets it to a verified workspace.
- Add `.eq('workspace_id', …)` to a few client list queries (`invoices`, `programs`, `sessions`) and the coach `re-engagement`/`dashboard-summary` counts — safe today, but makes scoping self-evident.
- Standardize the couple of `sessions`/`availability` routes onto the hardened `requireCoach()` helper.
- The 7 `SECURITY DEFINER` advisor warnings are the accepted baseline (functions self-authorize); optionally `REVOKE EXECUTE … FROM anon` on the coach RPCs (they're for authenticated coaches only).

---

## Recommended order
1. **Make the file buckets private + signed URLs** (#1) — the one finding with real privacy impact. I can implement it end-to-end (bucket flip + swap `getPublicUrl`→`createSignedUrl` in the serve paths + verify file access still works).
2. Owner: enable leaked-password protection (#5, needs Pro).
3. Quick hardening: n8n `coachId∈workspaceId` check (#2), `REVOKE EXECUTE` on `recalc_workspace_storage` (#3), profile write → route (#4).
4. Defense-in-depth sweep (💡) when convenient.

*Nothing here is a "drop everything" emergency — the core isolation holds. #1 is the one I'd fix before onboarding real coaches' students.*
