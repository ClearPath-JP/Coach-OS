-- Prevent two workspaces from registering the same Google Drive import folder.
-- Multi-tenancy correctness: resolveWorkspaceForDriveFolder uses maybeSingle(), which throws
-- on multiple rows. Without this constraint, a coach pasting another coach's folder ID
-- would break imports for BOTH workspaces silently.
--
-- Partial unique index: allows many workspaces with NULL (no folder configured yet),
-- but rejects duplicate non-null values.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_workspaces_google_drive_import_folder_id
  ON public.workspaces (google_drive_import_folder_id)
  WHERE google_drive_import_folder_id IS NOT NULL;
