-- Daily client check-ins (mood, energy, note) for retention and coach visibility.

CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  mood_score integer NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  energy_score integer CHECK (energy_score BETWEEN 1 AND 5),
  note text CHECK (char_length(note) <= 300),
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, checkin_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_workspace_coach"
  ON public.daily_checkins FOR ALL
  USING (workspace_id = public.current_workspace_id());

CREATE POLICY "checkins_client_insert"
  ON public.daily_checkins FOR INSERT
  WITH CHECK (
    workspace_id = (
      SELECT c.workspace_id
      FROM public.clients c
      WHERE c.id = daily_checkins.client_id
        AND c.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
      LIMIT 1
    )
  );

CREATE POLICY "checkins_client_select"
  ON public.daily_checkins FOR SELECT
  USING (
    client_id = (
      SELECT c.id
      FROM public.clients c
      WHERE c.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
      LIMIT 1
    )
  );

CREATE INDEX idx_checkins_client_date
  ON public.daily_checkins(client_id, checkin_date DESC);

CREATE INDEX idx_checkins_workspace_date
  ON public.daily_checkins(workspace_id, checkin_date DESC);
