-- Workspace logos and coach avatars use storage bucket "avatars" with getPublicUrl().
-- If the bucket is private, those URLs return 403 and logos never load in the browser or Next/Image.
-- This migration ensures the bucket exists, is public, and anonymous reads are allowed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Upload paths from lib/post-upload.ts: avatars/{userId}/... and workspaces/{workspaceId}/...
DROP POLICY IF EXISTS "avatars_authenticated_insert_own_paths" ON storage.objects;
CREATE POLICY "avatars_authenticated_insert_own_paths"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) = auth.uid()::text
      )
      OR
      (
        split_part(name, '/', 1) = 'workspaces'
        AND EXISTS (
          SELECT 1
          FROM public.coaches c
          WHERE c.user_id = auth.uid()
            AND c.workspace_id::text = split_part(name, '/', 2)
        )
      )
    )
  );

DROP POLICY IF EXISTS "avatars_authenticated_update_own_paths" ON storage.objects;
CREATE POLICY "avatars_authenticated_update_own_paths"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) = auth.uid()::text
      )
      OR
      (
        split_part(name, '/', 1) = 'workspaces'
        AND EXISTS (
          SELECT 1
          FROM public.coaches c
          WHERE c.user_id = auth.uid()
            AND c.workspace_id::text = split_part(name, '/', 2)
        )
      )
    )
  );

DROP POLICY IF EXISTS "avatars_authenticated_delete_own_paths" ON storage.objects;
CREATE POLICY "avatars_authenticated_delete_own_paths"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) = auth.uid()::text
      )
      OR
      (
        split_part(name, '/', 1) = 'workspaces'
        AND EXISTS (
          SELECT 1
          FROM public.coaches c
          WHERE c.user_id = auth.uid()
            AND c.workspace_id::text = split_part(name, '/', 2)
        )
      )
    )
  );
