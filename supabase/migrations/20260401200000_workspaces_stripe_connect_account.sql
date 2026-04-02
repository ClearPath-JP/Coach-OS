-- Stripe Connect Express account id for client invoice checkout (destination charges).
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_connect_account
  ON public.workspaces (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
