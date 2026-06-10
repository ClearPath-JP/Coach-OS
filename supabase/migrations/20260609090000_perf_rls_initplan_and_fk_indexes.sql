-- Performance: RLS initplan rewrite + high-traffic FK indexes — 2026-06-09
-- Source: Supabase performance advisor (360 lints digested; 56 auth_rls_initplan WARNs).
-- STAGED ONLY — apply via the dashboard SQL editor (MCP is read-only).
--
-- [1] Wrap every bare auth.uid()/jwt()/role()/email() in RLS policies as (select auth.*())
--     so Postgres evaluates it ONCE per query (InitPlan) instead of once per row.
--     Semantics-preserving: same value, same access decisions, less Disk IO.
--     Safety notes:
--       * Expressions come from pg_policies (Postgres's own deparsed catalog of OUR policies),
--         not user input; they are re-parsed by ALTER POLICY, which rejects malformed SQL.
--       * The whole script runs in ONE transaction — any failure rolls back everything.
--       * A final self-check RAISES EXCEPTION (rolling back) if any bare auth.*() remains.
--     AFTER APPLYING: re-run the performance advisor (auth_rls_initplan should drop 56 -> 0)
--     and smoke-test login, client portal, class booking, and messages.

BEGIN;

DO $$
DECLARE p record; nq text; nc text; s text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ~ 'auth\.(uid|jwt|role|email)\(\)' OR with_check ~ 'auth\.(uid|jwt|role|email)\(\)')
  LOOP
    nq := p.qual;  nc := p.with_check;
    IF nq IS NOT NULL THEN
      nq := replace(nq, 'SELECT auth.', '@@W@@'); -- mask already-wrapped occurrences
      nq := regexp_replace(nq, 'auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
      nq := replace(nq, '@@W@@', 'SELECT auth.');
    END IF;
    IF nc IS NOT NULL THEN
      nc := replace(nc, 'SELECT auth.', '@@W@@');
      nc := regexp_replace(nc, 'auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
      nc := replace(nc, '@@W@@', 'SELECT auth.');
    END IF;
    s := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF nq IS NOT NULL THEN s := s || format(' USING (%s)', nq); END IF;
    IF nc IS NOT NULL THEN s := s || format(' WITH CHECK (%s)', nc); END IF;
    EXECUTE s;
  END LOOP;
END $$;

-- [2] Highest-traffic FK covering indexes (instant on current data sizes).
CREATE INDEX IF NOT EXISTS idx_video_assignments_client   ON public.video_assignments(client_id);   -- portal home/library, every client load
CREATE INDEX IF NOT EXISTS idx_session_invoices_coach     ON public.session_invoices(coach_id);     -- coach invoices page
CREATE INDEX IF NOT EXISTS idx_payments_invoice           ON public.payments(invoice_id);           -- Stripe webhook/reconciliation lookups
CREATE INDEX IF NOT EXISTS idx_activity_log_user          ON public.activity_log(user_id);          -- fastest-growing table; index while cheap
CREATE INDEX IF NOT EXISTS idx_class_passes_coach         ON public.class_passes(coach_id);         -- passes management
CREATE INDEX IF NOT EXISTS idx_client_passes_pass         ON public.client_passes(pass_id);         -- RESTRICT-FK checks + pass joins
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_coach      ON public.scheduled_posts(coach_id);      -- Studio scheduled tab

-- [3] Self-verification: abort the whole transaction if any bare auth.*() survived
--     (i.e. the rewrite missed something) — guarantees we never half-apply.
DO $$
DECLARE remaining int;
BEGIN
  -- Strip every wrapped form "( SELECT auth.xxx() ... )" first; anything left matching
  -- auth.xxx() is genuinely bare. Case-insensitive to cover deparse normalization.
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      regexp_replace(coalesce(qual, ''), '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)[^)]*\)', '', 'gi')
        ~* 'auth\.(uid|jwt|role|email)\(\)'
      OR
      regexp_replace(coalesce(with_check, ''), '\(\s*SELECT\s+auth\.(uid|jwt|role|email)\(\)[^)]*\)', '', 'gi')
        ~* 'auth\.(uid|jwt|role|email)\(\)'
    );
  IF remaining > 0 THEN
    RAISE EXCEPTION 'RLS initplan rewrite incomplete: % policies still contain bare auth.*() — transaction rolled back', remaining;
  END IF;
  RAISE NOTICE 'RLS initplan rewrite verified: 0 bare auth.*() calls remain.';
END $$;

COMMIT;

-- [4] OPTIONAL cleanup (uncomment when ready): byte-identical duplicate index on videos —
-- dropping halves write IO for that index. Held back per tonight's "no drops" rule.
-- DROP INDEX IF EXISTS public.idx_videos_workspace;  -- exact duplicate of idx_videos_workspace_id
