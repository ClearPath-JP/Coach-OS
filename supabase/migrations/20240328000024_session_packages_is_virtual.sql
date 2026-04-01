-- Virtual (online) vs in-person session packages for pricing and booking hints.
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS is_virtual boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.session_packages.is_virtual IS 'true = online (video/phone); false = in-person';
