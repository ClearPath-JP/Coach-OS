-- Avatar / logo URL on coach profile (GET /api/settings maps to profile.avatarUrl).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
