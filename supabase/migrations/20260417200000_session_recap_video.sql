-- Add recap video to sessions so coaches can attach a video after each session.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recap_video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_recap_video ON public.sessions (recap_video_id) WHERE recap_video_id IS NOT NULL;
