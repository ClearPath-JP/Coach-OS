ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS cashapp_username TEXT,
  ADD COLUMN IF NOT EXISTS venmo_username TEXT,
  ADD COLUMN IF NOT EXISTS paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS zelle_email_or_phone TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspaces_payment_instructions_max_300'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_payment_instructions_max_300
      CHECK (payment_instructions IS NULL OR char_length(payment_instructions) <= 300);
  END IF;
END $$;
