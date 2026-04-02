-- Run after 20240316000006_subscriptions_billing.sql
--
-- Stripe webhook events should only be
-- readable by service role, not by
-- authenticated users through the client.
ALTER TABLE public.stripe_webhook_events
  ENABLE ROW LEVEL SECURITY;

-- No SELECT policy = authenticated users
-- cannot read this table via anon key.
-- Service role bypasses RLS (correct).

-- Prevent any user from inserting directly:
CREATE POLICY "no_direct_insert"
  ON public.stripe_webhook_events
  FOR INSERT
  WITH CHECK (false);

-- Prevent any user from updating directly:
CREATE POLICY "no_direct_update"
  ON public.stripe_webhook_events
  FOR UPDATE
  USING (false);

-- Prevent any user from deleting directly:
CREATE POLICY "no_direct_delete"
  ON public.stripe_webhook_events
  FOR DELETE
  USING (false);

-- No SELECT policy needed = defaults to deny.
-- Only service role (webhook handler)
-- can read or write this table.
