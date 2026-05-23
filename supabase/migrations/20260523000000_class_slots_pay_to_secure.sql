-- Class slots + pay-to-secure-spot
-- Decision 2026-05-23: refined schedule model — coach sets weekly class slots with capacity,
-- clients pay via Stripe Checkout to claim a spot. Capacity lives on session_packages
-- (the class type). 0% platform fee for now.

-- 1. Capacity on session_packages — defines how many spots per class instance
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0);

COMMENT ON COLUMN public.session_packages.capacity IS
  'Max attendees per class instance. 1 = 1-on-1, >1 = group class.';

-- 2. Coach toggle — does this recurring slot allow client self-booking via Stripe?
ALTER TABLE public.recurring_availability
  ADD COLUMN IF NOT EXISTS is_client_bookable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.recurring_availability.is_client_bookable IS
  'When true, clients can self-book this slot via Stripe Checkout. Requires session_product_id.';

-- 3. Track Stripe-initiated bookings on the existing sessions table
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recurring_availability_id UUID
    REFERENCES public.recurring_availability(id) ON DELETE SET NULL;
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS stripe_checkout_id TEXT;
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sessions.recurring_availability_id IS
  'Links a booked session back to the recurring slot template it came from.';
COMMENT ON COLUMN public.sessions.stripe_checkout_id IS
  'Stripe Checkout Session ID for client-initiated bookings. Null for coach-created sessions.';
COMMENT ON COLUMN public.sessions.paid_at IS
  'When client payment cleared (via Stripe webhook). Null for free/manual bookings.';

-- 4. Helpful indexes for the new query patterns
CREATE INDEX IF NOT EXISTS idx_sessions_recurring_availability
  ON public.sessions(recurring_availability_id)
  WHERE recurring_availability_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_stripe_checkout
  ON public.sessions(stripe_checkout_id)
  WHERE stripe_checkout_id IS NOT NULL;

-- Composite for fast "how many paid for this slot on this date" queries
CREATE INDEX IF NOT EXISTS idx_sessions_paid_per_slot_date
  ON public.sessions(recurring_availability_id, scheduled_time)
  WHERE paid_at IS NOT NULL;

-- 5. Unique constraint: a client can't double-book the same slot at the same time
-- (Stripe webhooks can fire twice, so this is the safety net)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sessions_one_booking_per_client_per_slot_instance
  ON public.sessions(client_id, recurring_availability_id, scheduled_time)
  WHERE recurring_availability_id IS NOT NULL AND client_id IS NOT NULL;
