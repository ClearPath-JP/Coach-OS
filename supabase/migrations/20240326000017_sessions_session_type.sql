-- Optional delivery type for client calendar badges (video / phone / in person).
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_type TEXT;
