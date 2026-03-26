-- Enable Supabase Realtime for coach–client message threads (INSERT/UPDATE subscriptions).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
