-- Secret token for subscribing to coach calendar without browser cookies (Google Calendar "by URL").
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS coach_calendar_feed_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_coach_calendar_feed_token
  ON public.workspaces (coach_calendar_feed_token)
  WHERE coach_calendar_feed_token IS NOT NULL;
