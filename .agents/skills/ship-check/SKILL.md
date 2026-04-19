---
name: ship-check
description: Pre-deploy safety checklist. Use before deploying to production, pushing to main, or running vercel --prod. Catches env issues, leaked secrets, missing auth, broken URLs, and compile errors.
version: 1.0.0
user-invocable: true
allowed-tools: Read Grep Bash Glob
---

# Ship Check — Pre-Deploy Safety Gate

Run this checklist before every production deploy. Fix all FAIL items before shipping.

## Checks to Run

Execute each check. Report results as PASS or FAIL with details.

### 1. TypeScript compiles
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
```
- **PASS:** 0 errors
- **FAIL:** List the errors. Do not deploy with type errors.

### 2. No console.log in production code
```bash
grep -r "console\.log" app/ lib/ components/ --include="*.ts" --include="*.tsx" -l
```
- **PASS:** No matches (or only in error handlers / dev-only files)
- **FAIL:** List files. Remove or replace with proper error logging.

### 3. No hardcoded localhost
```bash
grep -rn "localhost" app/ lib/ components/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test."
```
- **PASS:** No matches (or only in dev-mode conditionals)
- **FAIL:** List lines. Replace with env vars or production URLs.

### 4. No .env values in code
```bash
grep -rn "sk-\|sk_live\|sk_test\|supabase.*eyJ\|SUPABASE_SERVICE_ROLE" app/ lib/ components/ --include="*.ts" --include="*.tsx"
```
- **PASS:** No API keys or secrets in source code
- **FAIL:** CRITICAL. Remove immediately. Use environment variables.

### 5. New API routes have auth
For each API route modified in the current diff, verify:
- Route calls `getUser()` or `assertAdminApi()` or has a `public-ok` comment
- No route is unintentionally public

### 6. No TODO/FIXME/HACK in changed files
```bash
git diff HEAD~1 --name-only | xargs grep -n "TODO\|FIXME\|HACK\|XXX" 2>/dev/null
```
- **PASS:** No blockers in recently changed code
- **FAIL:** Evaluate if any are ship-blocking

### 7. Git state is clean
```bash
git status --short
```
- **PASS:** No uncommitted changes (or only untracked config files)
- **FAIL:** Commit or stash before deploying

## Output Format

```
SHIP CHECK RESULTS
==================
[PASS] TypeScript compiles (0 errors)
[PASS] No console.log in production code
[PASS] No hardcoded localhost
[PASS] No secrets in source code
[PASS] API routes have auth
[PASS] No blocking TODOs
[PASS] Git state clean

VERDICT: READY TO SHIP
```

Or:

```
SHIP CHECK RESULTS
==================
[PASS] TypeScript compiles
[FAIL] console.log found in 2 files
[PASS] No hardcoded localhost
[PASS] No secrets in source code
[FAIL] New route /api/foo missing auth check
[PASS] No blocking TODOs
[PASS] Git state clean

VERDICT: FIX 2 ISSUES BEFORE DEPLOYING
- Remove console.log from: app/api/videos/route.ts, lib/utils.ts
- Add auth to: app/api/foo/route.ts
```

## Rules

- Run ALL checks. Don't skip any.
- FAIL on secrets is always a blocker — never deploy with leaked keys.
- FAIL on auth is always a blocker — never deploy an unprotected route.
- FAIL on console.log or TODO is a judgment call — note it but don't block if trivial.
- Be fast. This should take under 30 seconds.
