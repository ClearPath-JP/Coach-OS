-- Make Stripe webhook dedup atomic (prevents double-processing under concurrent replay).
-- Owner: apply via the Supabase dashboard / db push. Safe + additive; assumes no existing duplicate event_id rows.
CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_events_event_id_key
  ON public.stripe_webhook_events (event_id);
