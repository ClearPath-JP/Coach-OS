-- Client video library (2026-06-08): a coach can mark a video "shared with clients" so it
-- shows in the client portal's Videos tab — separate from program/assignment access. Access
-- to playback is still gated server-side (clientCanAccessVideo + the token route); this flag
-- only controls library visibility.
alter table public.videos add column if not exists shared_with_clients boolean not null default false;

-- Partial index for the client library listing (shared, not-deleted, per workspace).
create index if not exists idx_videos_shared_with_clients
  on public.videos(workspace_id)
  where shared_with_clients = true and deleted_at is null;
