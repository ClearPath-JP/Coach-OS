-- Lint 0025 (public_bucket_allows_listing) — 2026-06-07
-- Drop the broad anon/authenticated SELECT (listing) policies on storage.objects for the
-- public buckets. Public-URL downloads are unaffected (public buckets bypass RLS on the
-- /object/public path); the app accesses storage only via the service role + getPublicUrl,
-- never client-side listing. This removes anonymous object enumeration.
drop policy if exists "assignment_submissions_public_select" on storage.objects;
drop policy if exists "avatars_public_select" on storage.objects;
drop policy if exists "studio_audio_public_select" on storage.objects;
drop policy if exists "videos_storage_select_public" on storage.objects;
