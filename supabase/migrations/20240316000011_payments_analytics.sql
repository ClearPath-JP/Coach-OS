-- Session 17: reshape public.payments for manual + invoice-linked payment tracking and analytics.
-- Migrates legacy columns (provider, payer_client_id, status, session_request_id, etc.) to the new model.

-- ---------- 1) Add new columns ----------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.session_invoices(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT (CURRENT_DATE);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---------- 2) Backfill from legacy columns ----------
UPDATE public.payments
SET client_id = payer_client_id
WHERE client_id IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments' AND c.column_name = 'payer_client_id'
  )
  AND payer_client_id IS NOT NULL;

UPDATE public.payments
SET payment_method = CASE provider
  WHEN 'stripe' THEN 'stripe'
  WHEN 'zelle' THEN 'zelle'
  WHEN 'paypal' THEN 'paypal'
  WHEN 'cashapp' THEN 'cashapp'
  ELSE 'other'
END
WHERE payment_method IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments' AND c.column_name = 'provider'
  );

UPDATE public.payments
SET payment_reference = stripe_payment_intent_id
WHERE payment_reference IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments' AND c.column_name = 'stripe_payment_intent_id'
  )
  AND stripe_payment_intent_id IS NOT NULL;

UPDATE public.payments
SET notes = description
WHERE notes IS NULL
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'payments' AND c.column_name = 'description'
  )
  AND description IS NOT NULL;

UPDATE public.payments
SET payment_date = (created_at AT TIME ZONE 'UTC')::date
WHERE payment_date IS NULL;

UPDATE public.payments SET payment_method = 'other' WHERE payment_method IS NULL;

-- Rows that cannot be tied to a client are removed (legacy incomplete rows)
DELETE FROM public.payments WHERE client_id IS NULL;

-- ---------- 3) Drop legacy FKs / columns ----------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_session_request_id_fkey;
ALTER TABLE public.payments DROP COLUMN IF EXISTS session_request_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS payer_client_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS status;
ALTER TABLE public.payments DROP COLUMN IF EXISTS provider;
ALTER TABLE public.payments DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS description;

-- ---------- 4) coach_id → auth.users (profiles PK already references auth.users) ----------
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_coach_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_coach_id_fkey
  FOREIGN KEY (coach_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------- 5) NOT NULL + CHECK ----------
ALTER TABLE public.payments ALTER COLUMN payment_date SET DEFAULT (CURRENT_DATE);
ALTER TABLE public.payments ALTER COLUMN payment_date SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE public.payments ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check CHECK (
    payment_method IN (
      'cash', 'venmo', 'cashapp', 'zelle',
      'paypal', 'bank_transfer', 'stripe', 'other'
    )
  );
ALTER TABLE public.payments ALTER COLUMN payment_method SET NOT NULL;

-- ---------- 6) Indexes ----------
CREATE INDEX IF NOT EXISTS idx_payments_workspace_client_date_method
  ON public.payments (workspace_id, client_id, payment_date DESC, payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON public.payments (payment_method);

-- ---------- 7) updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.payments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE PROCEDURE public.payments_set_updated_at();
