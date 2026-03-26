-- Enable Realtime for videos table (Session 13 — live status updates on coach videos page)
-- Idempotent: skip if already in publication (e.g. applied manually or duplicate push).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
