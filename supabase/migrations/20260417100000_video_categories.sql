-- Video categories with preset colors for organization.
-- Replaces free-text category field on videos with a proper table.

CREATE TABLE IF NOT EXISTS public.video_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each workspace can only have one category with the same name
CREATE UNIQUE INDEX IF NOT EXISTS uniq_video_categories_workspace_name
  ON public.video_categories (workspace_id, lower(name));

-- RLS
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_categories_select_workspace"
  ON public.video_categories FOR SELECT
  USING (workspace_id = current_workspace_id());

CREATE POLICY "video_categories_insert_workspace"
  ON public.video_categories FOR INSERT
  WITH CHECK (workspace_id = current_workspace_id());

CREATE POLICY "video_categories_update_workspace"
  ON public.video_categories FOR UPDATE
  USING (workspace_id = current_workspace_id());

CREATE POLICY "video_categories_delete_workspace"
  ON public.video_categories FOR DELETE
  USING (workspace_id = current_workspace_id());

-- Add category_id FK to videos
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.video_categories(id) ON DELETE SET NULL;

-- Migrate existing text categories to the new table and link them.
-- Auto-assigns colors round-robin from the preset palette.
DO $$
DECLARE
  _ws_id UUID;
  _cat TEXT;
  _cat_id UUID;
  _color TEXT;
  _colors TEXT[] := ARRAY['red','orange','amber','green','teal','blue','purple','pink'];
  _idx INTEGER;
BEGIN
  _idx := 0;
  FOR _ws_id, _cat IN
    SELECT DISTINCT workspace_id, category
    FROM public.videos
    WHERE category IS NOT NULL AND trim(category) != '' AND deleted_at IS NULL
    ORDER BY workspace_id, category
  LOOP
    _color := _colors[(_idx % 8) + 1];
    INSERT INTO public.video_categories (workspace_id, name, color, position)
    VALUES (_ws_id, trim(_cat), _color, _idx)
    ON CONFLICT DO NOTHING
    RETURNING id INTO _cat_id;

    -- If insert was skipped (conflict), look up existing
    IF _cat_id IS NULL THEN
      SELECT id INTO _cat_id FROM public.video_categories
      WHERE workspace_id = _ws_id AND lower(name) = lower(trim(_cat));
    END IF;

    -- Link videos to the new category row
    IF _cat_id IS NOT NULL THEN
      UPDATE public.videos
      SET category_id = _cat_id
      WHERE workspace_id = _ws_id
        AND lower(trim(category)) = lower(trim(_cat))
        AND category_id IS NULL;
    END IF;

    _idx := _idx + 1;
  END LOOP;
END;
$$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_videos_category_id ON public.videos (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_categories_workspace ON public.video_categories (workspace_id);
