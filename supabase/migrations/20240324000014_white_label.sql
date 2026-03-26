-- Session 18: White label branding columns on workspaces (coach-configurable client portal copy).

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS brand_tagline TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS client_portal_heading TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS client_welcome_message TEXT;

COMMENT ON COLUMN public.workspaces.brand_name IS 'Optional coach brand shown in client portal nav instead of ClearPath';
COMMENT ON COLUMN public.workspaces.brand_tagline IS 'Optional short tagline for client-facing surfaces';
COMMENT ON COLUMN public.workspaces.client_portal_heading IS 'Optional portal home heading, e.g. Welcome to Peak Performance';
COMMENT ON COLUMN public.workspaces.client_welcome_message IS 'Optional welcome message card on first portal visit';
