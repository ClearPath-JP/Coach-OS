-- Add stance_id column for GoT-inspired visual theme system
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stance_id TEXT DEFAULT 'izuhara';

COMMENT ON COLUMN public.workspaces.stance_id
  IS 'Visual theme stance (GoT region): izuhara, toyotama, kamiagata, crimson, ronin';
