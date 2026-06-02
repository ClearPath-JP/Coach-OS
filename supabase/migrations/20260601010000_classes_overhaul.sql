-- Classes overhaul (2026-06-01): rich class fields + per-occurrence overrides + attendance.
-- A "class" stays backed by recurring_availability (slot) + session_packages (price/capacity/
-- duration). These columns add the rich per-class fields. Multi-day classes are multiple
-- recurring_availability rows sharing class_group_id. member_access connects to Dojo Memberships
-- (stored now, inert until the memberships feature ships).

ALTER TABLE public.recurring_availability
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','draft')),
  ADD COLUMN IF NOT EXISTS one_time_date DATE,
  ADD COLUMN IF NOT EXISTS member_access TEXT NOT NULL DEFAULT 'drop_in_only'
    CHECK (member_access IN ('included','members_only','drop_in_only')),
  ADD COLUMN IF NOT EXISTS class_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_recurring_availability_group
  ON public.recurring_availability(class_group_id);

-- Attendance, marked from the bookings panel.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS attended BOOLEAN,
  ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMPTZ;

-- Per-occurrence edits/cancellations for recurring classes ("this occurrence" vs "all future").
CREATE TABLE IF NOT EXISTS public.class_occurrence_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recurring_availability_id UUID NOT NULL REFERENCES public.recurring_availability(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  canceled BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  capacity INTEGER,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recurring_availability_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_coo_workspace
  ON public.class_occurrence_overrides(workspace_id);

ALTER TABLE public.class_occurrence_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coo_select" ON public.class_occurrence_overrides;
CREATE POLICY "coo_select" ON public.class_occurrence_overrides
  FOR SELECT USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "coo_insert" ON public.class_occurrence_overrides;
CREATE POLICY "coo_insert" ON public.class_occurrence_overrides
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "coo_update" ON public.class_occurrence_overrides;
CREATE POLICY "coo_update" ON public.class_occurrence_overrides
  FOR UPDATE USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "coo_delete" ON public.class_occurrence_overrides;
CREATE POLICY "coo_delete" ON public.class_occurrence_overrides
  FOR DELETE USING (workspace_id = current_workspace_id());
