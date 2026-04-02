-- Client goal tracking (coach + client RLS)

CREATE TABLE public.client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  category text DEFAULT 'general'
    CHECK (category IN (
      'fitness', 'nutrition', 'mindset',
      'business', 'relationship',
      'health', 'performance', 'general'
    )),
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text,
  start_value numeric,
  target_date date,
  status text DEFAULT 'active'
    CHECK (status IN (
      'active', 'achieved',
      'paused', 'abandoned'
    )),
  achieved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_workspace"
  ON public.client_goals FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
  );

CREATE POLICY "goals_client_select"
  ON public.client_goals FOR SELECT
  USING (
    client_id = (
      SELECT c.id FROM public.clients c
      WHERE c.email = (
        SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
      )
        AND c.workspace_id = public.client_goals.workspace_id
      LIMIT 1
    )
  );

CREATE INDEX idx_client_goals_client
  ON public.client_goals(client_id, workspace_id, status);

CREATE TABLE public.client_goal_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.client_goals(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  previous_value numeric,
  new_value numeric NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_goal_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_updates_workspace"
  ON public.client_goal_updates FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
  );

CREATE POLICY "goal_updates_client_select"
  ON public.client_goal_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_goals g
      WHERE g.id = client_goal_updates.goal_id
        AND g.client_id = (
          SELECT c.id FROM public.clients c
          WHERE c.email = (
            SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
          )
            AND c.workspace_id = g.workspace_id
          LIMIT 1
        )
    )
  );

CREATE INDEX idx_client_goal_updates_goal
  ON public.client_goal_updates(goal_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.client_goals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_goals_set_updated_at ON public.client_goals;
CREATE TRIGGER client_goals_set_updated_at
  BEFORE UPDATE ON public.client_goals
  FOR EACH ROW
  EXECUTE PROCEDURE public.client_goals_set_updated_at();
