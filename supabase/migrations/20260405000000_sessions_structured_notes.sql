-- Structured session notes: coach private summary, shareable summary, action items, send timestamp.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS coach_private_notes text,
  ADD COLUMN IF NOT EXISTS session_summary text,
  ADD COLUMN IF NOT EXISTS action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes_sent_at timestamptz;

COMMENT ON COLUMN public.sessions.action_items IS 'Array of {id,text,assigned_to,completed,completed_at}';
